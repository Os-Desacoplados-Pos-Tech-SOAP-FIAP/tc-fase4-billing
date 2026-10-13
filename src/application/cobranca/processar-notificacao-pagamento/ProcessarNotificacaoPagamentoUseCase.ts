import { Inject, Injectable, Logger } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';
import { ICobrancaRepository } from '../../../domain/cobranca/repositories/ICobrancaRepository';
import { IPagamentoRepository } from '../../../domain/cobranca/repositories/IPagamentoRepository';
import { ensureFound } from '../../ensure-found';
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
 * reenvia notificações.
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
  ) {}

  async execute(mpPaymentId: string): Promise<void> {
    const pagamento = await this.gateway.consultarPagamento(mpPaymentId);
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
    await this.transacao.run(() => this.aplicar(pagamento, cobranca.id.toValue()));
  }

  private async aplicar(pagamento: PagamentoNoGateway, cobrancaId: string): Promise<void> {
    await this.pagamentos.registrar({
      mpPaymentId: pagamento.id,
      cobrancaId,
      status: pagamento.status,
      valor: pagamento.valor,
      payloadBruto: pagamento.bruto,
    });
    const cobranca = ensureFound(await this.cobrancas.buscarPorId(cobrancaId), 'Cobrança');
    if (pagamento.status === STATUS_APROVADO) {
      await this.confirmar(cobranca, pagamento);
    } else if (STATUS_RECUSADOS.has(pagamento.status)) {
      await this.recusar(cobranca, pagamento);
    }
    // pending / in_process: fica só registrado até a próxima notificação.
  }

  private async confirmar(cobranca: Cobranca, pagamento: PagamentoNoGateway): Promise<void> {
    const contexto = {
      osId: cobranca.osId,
      cobrancaId: cobranca.id.toValue(),
      mpPaymentId: pagamento.id,
    };
    if (cobranca.status === StatusCobranca.PAGA) {
      if (cobranca.mpPaymentId !== pagamento.id) {
        this.logger.error({ msg: 'Segundo pagamento aprovado para cobrança já paga', ...contexto });
      }
      return;
    }
    if (centavos(pagamento.valor) < centavos(cobranca.valor)) {
      this.logger.error({
        msg: 'Pagamento aprovado com valor menor que a cobrança; não confirmado',
        ...contexto,
        valorPago: pagamento.valor,
        valorCobrado: cobranca.valor,
      });
      return;
    }
    if (cobranca.status === StatusCobranca.RECUSADA) {
      await this.alertarSegundoPagamento(cobranca, contexto);
    }
    cobranca.confirmar(pagamento.id);
    await this.cobrancas.salvar(cobranca);
    await this.outbox.publicar(eventoPagamentoConfirmado(cobranca));
  }

  /**
   * Cobrança recusada paga depois (D7) quando a OS já tem outra paga: o dinheiro entrou duas
   * vezes. Confirma mesmo assim e deixa o rastro para estorno manual. Consulta antes de
   * confirmar, para não encontrar a própria cobrança.
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

  private async recusar(cobranca: Cobranca, pagamento: PagamentoNoGateway): Promise<void> {
    if (cobranca.status !== StatusCobranca.PENDENTE) return;
    cobranca.recusar(pagamento.id);
    await this.cobrancas.salvar(cobranca);
    await this.outbox.publicar(
      eventoPagamentoRecusado(cobranca, pagamento.statusDetail ?? pagamento.status),
    );
  }
}
