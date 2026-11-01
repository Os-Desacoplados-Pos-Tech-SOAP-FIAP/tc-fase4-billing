import { Inject, Injectable, Logger } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';
import { ICobrancaRepository } from '../../../domain/cobranca/repositories/ICobrancaRepository';
import { IPagamentoRepository } from '../../../domain/cobranca/repositories/IPagamentoRepository';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { emailPagamentoAprovado, emailPagamentoRecusado } from '../../emails';
import { ensureFound } from '../../ensure-found';
import { RecursoNaoEncontradoError } from '../../errors';
import { notificarSemFalhar } from '../../notificar';
import { Email, INotificador } from '../../ports/notificador';
import { IOutbox } from '../../ports/outbox';
import {
  IPaymentGateway,
  PagamentoNoGateway,
  STATUS_APROVADO,
  STATUS_RECUSADOS,
} from '../../ports/payment-gateway';
import { ITransactionManager } from '../../ports/transaction-manager';
import { eventoPagamentoConfirmado, eventoPagamentoRecusado } from '../eventos-cobranca';

const centavos = (valor: number): number => Math.round(valor * 100);

/**
 * Trata a notificação do gateway. O webhook só traz o id: o status vem sempre da consulta
 * à API (fonte da verdade). Idempotente pelo status da cobrança, já que o Mercado Pago
 * reenvia notificações. O e-mail ao cliente (aprovado ou recusado) sai só na transição de
 * status e depois do commit, sem nunca falhar o processamento.
 */
@Injectable()
export class ProcessarNotificacaoPagamentoUseCase {
  private readonly logger = new Logger(ProcessarNotificacaoPagamentoUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.TRANSACTION_MANAGER)
    private readonly transacao: ITransactionManager,
    @Inject(INJECTION_TOKENS.COBRANCA_REPOSITORY)
    private readonly cobrancas: ICobrancaRepository,
    @Inject(INJECTION_TOKENS.PAGAMENTO_REPOSITORY)
    private readonly pagamentos: IPagamentoRepository,
    @Inject(INJECTION_TOKENS.OUTBOX)
    private readonly outbox: IOutbox,
    @Inject(INJECTION_TOKENS.PAYMENT_GATEWAY)
    private readonly gateway: IPaymentGateway,
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
    @Inject(INJECTION_TOKENS.NOTIFICADOR)
    private readonly notificador: INotificador,
  ) {}

  async execute(mpPaymentId: string): Promise<void> {
    const pagamento = await this.consultar(mpPaymentId);
    if (!pagamento) return;
    const cobranca = pagamento.referenciaExterna
      ? await this.cobrancas.buscarPorId(pagamento.referenciaExterna)
      : null;
    if (!cobranca) {
      this.logger.warn({
        msg: 'Pagamento sem cobrança correspondente; ignorado',
        mpPaymentId,
        referenciaExterna: pagamento.referenciaExterna,
      });
      return;
    }
    const email = await this.transacao.run(() => this.aplicar(pagamento, cobranca.id.toValue()));
    if (email) await notificarSemFalhar(this.notificador, email, this.logger, cobranca.osId);
  }

  /** Id inexistente (ex.: notificação de teste do painel): ignora, para o webhook responder 200. */
  private async consultar(mpPaymentId: string): Promise<PagamentoNoGateway | null> {
    try {
      return await this.gateway.consultarPagamento(mpPaymentId);
    } catch (erro) {
      if (!(erro instanceof RecursoNaoEncontradoError)) throw erro;
      this.logger.warn({ msg: 'Pagamento inexistente no gateway; ignorado', mpPaymentId });
      return null;
    }
  }

  private async aplicar(
    pagamento: PagamentoNoGateway,
    cobrancaId: string,
  ): Promise<Email | null> {
    await this.pagamentos.registrar({
      mpPaymentId: pagamento.id,
      cobrancaId,
      status: pagamento.status,
      valor: pagamento.valor,
      payloadBruto: pagamento.bruto,
    });
    const cobranca = ensureFound(await this.cobrancas.buscarPorId(cobrancaId), 'Cobrança');
    if (pagamento.status === STATUS_APROVADO) return this.confirmar(cobranca, pagamento);
    if (STATUS_RECUSADOS.has(pagamento.status)) return this.recusar(cobranca, pagamento);
    // pending / in_process: fica só registrado até a próxima notificação.
    return null;
  }

  private async confirmar(
    cobranca: Cobranca,
    pagamento: PagamentoNoGateway,
  ): Promise<Email | null> {
    const contexto = {
      osId: cobranca.osId,
      cobrancaId: cobranca.id.toValue(),
      mpPaymentId: pagamento.id,
    };
    if (cobranca.status === StatusCobranca.PAGA) {
      if (cobranca.mpPaymentId !== pagamento.id) {
        this.logger.error({ msg: 'Segundo pagamento aprovado para cobrança já paga', ...contexto });
      }
      return null;
    }
    if (centavos(pagamento.valor) < centavos(cobranca.valor)) {
      this.logger.error({
        msg: 'Pagamento aprovado com valor menor que a cobrança; não confirmado',
        ...contexto,
        valorPago: pagamento.valor,
        valorCobrado: cobranca.valor,
      });
      return null;
    }
    await this.alertarSegundoPagamento(cobranca, contexto);
    cobranca.confirmar(pagamento.id);
    await this.cobrancas.salvar(cobranca);
    await this.outbox.publicar(eventoPagamentoConfirmado(cobranca));
    return this.emailAoCliente(cobranca.osId, (orcamento) =>
      emailPagamentoAprovado(orcamento, pagamento.valor),
    );
  }

  /**
   * Confirmação quando a OS já tem outra cobrança paga (D7, em qualquer ordem): o dinheiro
   * entrou duas vezes. Confirma mesmo assim e deixa o rastro para estorno manual. Consulta
   * antes de confirmar e ignora a própria cobrança.
   */
  private async alertarSegundoPagamento(
    cobranca: Cobranca,
    contexto: { osId: string; cobrancaId: string; mpPaymentId: string },
  ): Promise<void> {
    const outraPaga = await this.cobrancas.buscarPagaPorOs(cobranca.osId);
    if (!outraPaga || outraPaga.id.toValue() === cobranca.id.toValue()) return;
    this.logger.error({
      msg: 'Segundo pagamento aprovado na mesma OS (estorno manual)',
      ...contexto,
      outraCobrancaId: outraPaga.id.toValue(),
      outroMpPaymentId: outraPaga.mpPaymentId,
    });
  }

  private async recusar(
    cobranca: Cobranca,
    pagamento: PagamentoNoGateway,
  ): Promise<Email | null> {
    if (cobranca.status !== StatusCobranca.PENDENTE) return null;
    cobranca.recusar(pagamento.id);
    await this.cobrancas.salvar(cobranca);
    await this.outbox.publicar(
      eventoPagamentoRecusado(cobranca, pagamento.statusDetail ?? pagamento.status),
    );
    return this.emailAoCliente(cobranca.osId, emailPagamentoRecusado);
  }

  /** O e-mail do cliente fica no orçamento da OS (vem no comando gerar-orcamento). */
  private async emailAoCliente(
    osId: string,
    montar: (orcamento: Orcamento) => Email,
  ): Promise<Email | null> {
    const orcamento = await this.orcamentos.buscarPorOs(osId);
    if (orcamento) return montar(orcamento);
    this.logger.warn({ msg: 'Orçamento da OS não encontrado; e-mail não enviado', osId });
    return null;
  }
}
