import { Inject, Injectable, Logger } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import {
  ClienteOrcamento,
  ItemOrcamento,
  Orcamento,
  StatusOrcamento,
} from '../../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { BILLING_EVENTS, OrcamentoEnviadoPayload } from '../../billing-messages';
import { emailOrcamentoEnviado } from '../../emails';
import { notificarSemFalhar } from '../../notificar';
import { ConfigBilling } from '../../ports/config-billing';
import { ContextoMensagem, criarEnvelope } from '../../ports/message-envelope';
import { Email, INotificador } from '../../ports/notificador';
import { IOutbox } from '../../ports/outbox';
import { IProcessedMessageRepository } from '../../ports/processed-message.repository';
import { IRelogio } from '../../ports/relogio';
import { ITransactionManager } from '../../ports/transaction-manager';
import { gerarTokenAprovacao, linkDeAprovacao } from '../token-aprovacao';

const HORA_MS = 3_600_000;

export interface GerarOrcamentoInput extends ContextoMensagem {
  numeroOs: number;
  cliente: ClienteOrcamento;
  itens: ItemOrcamento[];
}

/**
 * Passo compensável da saga: cria o orçamento e manda ao cliente o link de aprovação.
 * O token só existe neste momento (no banco fica o hash), por isso o e-mail sai daqui,
 * depois do commit.
 */
@Injectable()
export class GerarOrcamentoUseCase {
  private readonly logger = new Logger(GerarOrcamentoUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.TRANSACTION_MANAGER)
    private readonly transacao: ITransactionManager,
    @Inject(INJECTION_TOKENS.PROCESSED_MESSAGE_REPOSITORY)
    private readonly mensagensProcessadas: IProcessedMessageRepository,
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
    @Inject(INJECTION_TOKENS.OUTBOX)
    private readonly outbox: IOutbox,
    @Inject(INJECTION_TOKENS.NOTIFICADOR)
    private readonly notificador: INotificador,
    @Inject(INJECTION_TOKENS.RELOGIO)
    private readonly relogio: IRelogio,
    @Inject(INJECTION_TOKENS.CONFIG_BILLING)
    private readonly config: ConfigBilling,
  ) {}

  async execute(input: GerarOrcamentoInput): Promise<void> {
    const email = await this.transacao.run(() => this.gerar(input));
    if (email) await notificarSemFalhar(this.notificador, email, this.logger, input.correlationId);
  }

  private async gerar(input: GerarOrcamentoInput): Promise<Email | null> {
    if (!(await this.mensagensProcessadas.registrar(input.messageId))) return null;

    const existente = await this.orcamentos.buscarPorOs(input.correlationId);
    if (existente) {
      await this.reemitir(existente, input);
      return null;
    }

    const { token, hash } = gerarTokenAprovacao();
    const validoAte = new Date(
      this.relogio.agora().getTime() + this.config.validadeOrcamentoHoras * HORA_MS,
    );
    const orcamento = Orcamento.criar({
      osId: input.correlationId,
      numeroOs: input.numeroOs,
      cliente: input.cliente,
      itens: input.itens,
      validoAte,
      tokenHash: hash,
    });
    await this.orcamentos.salvar(orcamento);
    await this.publicarEnviado(orcamento, input.messageId);
    return emailOrcamentoEnviado(
      orcamento,
      linkDeAprovacao(this.config.urlPublica, orcamento.numeroOs, token),
    );
  }

  /** Retentativa do orquestrador com outro messageId: só confirma de novo, sem novo token. */
  private async reemitir(existente: Orcamento, input: GerarOrcamentoInput): Promise<void> {
    if (existente.status !== StatusOrcamento.ENVIADO) {
      this.logger.warn({
        msg: 'gerar-orcamento para orçamento já decidido; ignorado',
        osId: input.correlationId,
        messageId: input.messageId,
        status: existente.status,
      });
      return;
    }
    await this.publicarEnviado(existente, input.messageId);
  }

  private publicarEnviado(orcamento: Orcamento, causationId: string): Promise<void> {
    return this.outbox.publicar(
      criarEnvelope<OrcamentoEnviadoPayload>(
        BILLING_EVENTS.ORCAMENTO_ENVIADO,
        orcamento.osId,
        {
          osId: orcamento.osId,
          orcamentoId: orcamento.id.toValue(),
          numeroOs: orcamento.numeroOs,
          valorTotal: orcamento.valorTotal,
          validoAte: orcamento.validoAte.toISOString(),
        },
        causationId,
      ),
    );
  }
}
