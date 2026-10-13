import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { RecursoNaoEncontradoError } from '../../application/errors';
import { ConfigBilling } from '../../application/ports/config-billing';
import {
  IPaymentGateway,
  ISimuladorPagamento,
  NovaPreferencia,
  PagamentoNoGateway,
  Preferencia,
} from '../../application/ports/payment-gateway';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';

/**
 * Gateway em memória para dev e testes (PAYMENT_PROVIDER=fake). Pagamentos vivem no
 * processo: com mais de uma réplica, simule na mesma réplica (uso local tem uma só).
 */
@Injectable()
export class FakePaymentGateway implements IPaymentGateway, ISimuladorPagamento {
  private readonly pagamentos = new Map<string, PagamentoNoGateway>();

  constructor(
    @Inject(INJECTION_TOKENS.CONFIG_BILLING)
    private readonly config: ConfigBilling,
  ) {}

  async criarPreferencia(nova: NovaPreferencia): Promise<Preferencia> {
    return {
      preferenceId: `fake-pref-${nova.cobrancaId}`,
      initPoint: `${this.config.urlPublica}/api/billing/dev/pagamentos/${nova.osId}/simular`,
    };
  }

  async consultarPagamento(id: string): Promise<PagamentoNoGateway> {
    const pagamento = this.pagamentos.get(id);
    if (!pagamento) throw new RecursoNaoEncontradoError('Pagamento');
    return pagamento;
  }

  registrarPagamento(dados: { referenciaExterna: string; valor: number; aprovado: boolean }): string {
    const id = `fake-${randomUUID()}`;
    this.pagamentos.set(id, {
      id,
      status: dados.aprovado ? 'approved' : 'rejected',
      statusDetail: dados.aprovado ? 'accredited' : 'cc_rejected_other_reason',
      referenciaExterna: dados.referenciaExterna,
      valor: dados.valor,
      bruto: { id, simulado: true },
    });
    return id;
  }
}
