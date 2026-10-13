import { Inject, Injectable } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Cobranca } from '../../../domain/cobranca/entities/Cobranca';
import { ICobrancaRepository } from '../../../domain/cobranca/repositories/ICobrancaRepository';
import { ensureFound } from '../../ensure-found';
import { ISimuladorPagamento } from '../../ports/payment-gateway';
import { ProcessarNotificacaoPagamentoUseCase } from '../processar-notificacao-pagamento/ProcessarNotificacaoPagamentoUseCase';

/**
 * Só com PAYMENT_PROVIDER=fake: registra um pagamento no gateway falso e segue o mesmo
 * caminho do webhook. Permite o fluxo local completo sem o Mercado Pago.
 */
@Injectable()
export class SimularPagamentoUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.COBRANCA_REPOSITORY)
    private readonly cobrancas: ICobrancaRepository,
    @Inject(INJECTION_TOKENS.SIMULADOR_PAGAMENTO)
    private readonly simulador: ISimuladorPagamento,
    private readonly processar: ProcessarNotificacaoPagamentoUseCase,
  ) {}

  async execute(osId: string, aprovado: boolean): Promise<Cobranca> {
    const pendente = ensureFound(
      await this.cobrancas.buscarPendentePorOs(osId),
      'Cobrança pendente',
    );
    const mpPaymentId = this.simulador.registrarPagamento({
      referenciaExterna: pendente.id.toValue(),
      valor: pendente.valor,
      aprovado,
    });
    await this.processar.execute(mpPaymentId);
    return ensureFound(await this.cobrancas.buscarPorId(pendente.id.toValue()), 'Cobrança');
  }
}
