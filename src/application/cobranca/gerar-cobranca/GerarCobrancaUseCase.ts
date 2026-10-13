import { Inject, Injectable, Logger } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';
import { ICobrancaRepository } from '../../../domain/cobranca/repositories/ICobrancaRepository';
import { Orcamento, StatusOrcamento } from '../../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { DomainError } from '../../../domain/shared/DomainError';
import { UniqueID } from '../../../domain/shared/UniqueID';
import { emailCobrancaGerada } from '../../emails';
import { ensureFound } from '../../ensure-found';
import { notificarSemFalhar } from '../../notificar';
import { ContextoMensagem } from '../../ports/message-envelope';
import { INotificador } from '../../ports/notificador';
import { IOutbox } from '../../ports/outbox';
import { IPaymentGateway } from '../../ports/payment-gateway';
import { IProcessedMessageRepository } from '../../ports/processed-message.repository';
import { ITransactionManager } from '../../ports/transaction-manager';
import { eventoCobrancaGerada, eventoPagamentoConfirmado } from '../eventos-cobranca';

/**
 * Cobrança no fim do fluxo (OS finalizada). A preferência é criada no gateway antes da
 * transação, com o id da cobrança já definido: se o commit falhar, a preferência órfã não
 * é cobrada e a retentativa cria outra. Contrato violado (sem orçamento aprovado) propaga
 * e a mensagem acaba na DLQ.
 */
@Injectable()
export class GerarCobrancaUseCase {
  private readonly logger = new Logger(GerarCobrancaUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.TRANSACTION_MANAGER)
    private readonly transacao: ITransactionManager,
    @Inject(INJECTION_TOKENS.PROCESSED_MESSAGE_REPOSITORY)
    private readonly mensagensProcessadas: IProcessedMessageRepository,
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
    @Inject(INJECTION_TOKENS.COBRANCA_REPOSITORY)
    private readonly cobrancas: ICobrancaRepository,
    @Inject(INJECTION_TOKENS.OUTBOX)
    private readonly outbox: IOutbox,
    @Inject(INJECTION_TOKENS.PAYMENT_GATEWAY)
    private readonly gateway: IPaymentGateway,
    @Inject(INJECTION_TOKENS.NOTIFICADOR)
    private readonly notificador: INotificador,
  ) {}

  async execute(input: ContextoMensagem): Promise<void> {
    const osId = input.correlationId;
    const orcamento = ensureFound(await this.orcamentos.buscarPorOs(osId), 'Orçamento');
    if (orcamento.status !== StatusOrcamento.APROVADO) {
      throw new DomainError(
        `Orçamento ${orcamento.status} não pode ser cobrado`,
        'ORCAMENTO_NAO_APROVADO',
      );
    }

    const existente =
      (await this.cobrancas.buscarPagaPorOs(osId)) ??
      (await this.cobrancas.buscarPendentePorOs(osId));
    if (existente) {
      await this.transacao.run(() => this.reemitir(existente, input));
      return;
    }

    const cobranca = await this.criarNoGateway(orcamento);
    const criada = await this.transacao.run(() => this.gravar(cobranca, input));
    if (criada) {
      await notificarSemFalhar(
        this.notificador,
        emailCobrancaGerada(orcamento, cobranca),
        this.logger,
        osId,
      );
    }
  }

  private async criarNoGateway(orcamento: Orcamento): Promise<Cobranca> {
    const id = new UniqueID();
    const preferencia = await this.gateway.criarPreferencia({
      cobrancaId: id.toValue(),
      osId: orcamento.osId,
      numeroOs: orcamento.numeroOs,
      valor: orcamento.valorTotal,
    });
    return Cobranca.criar(
      {
        osId: orcamento.osId,
        orcamentoId: orcamento.id.toValue(),
        valor: orcamento.valorTotal,
        ...preferencia,
      },
      id,
    );
  }

  private async gravar(cobranca: Cobranca, input: ContextoMensagem): Promise<boolean> {
    if (!(await this.mensagensProcessadas.registrar(input.messageId))) return false;
    await this.cobrancas.salvar(cobranca);
    await this.outbox.publicar(eventoCobrancaGerada(cobranca, input.messageId));
    return true;
  }

  /** Comando repetido: devolve o estado atual (link pendente ou pagamento já confirmado). */
  private async reemitir(existente: Cobranca, input: ContextoMensagem): Promise<void> {
    if (!(await this.mensagensProcessadas.registrar(input.messageId))) return;
    await this.outbox.publicar(
      existente.status === StatusCobranca.PAGA
        ? eventoPagamentoConfirmado(existente, input.messageId)
        : eventoCobrancaGerada(existente, input.messageId),
    );
  }
}
