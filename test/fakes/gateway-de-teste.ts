import {
  IPaymentGateway,
  NovaPreferencia,
  PagamentoNoGateway,
  Preferencia,
} from '../../src/application/ports/payment-gateway';

export class GatewayDeTeste implements IPaymentGateway {
  public preferencias: NovaPreferencia[] = [];
  public pagamentos = new Map<string, PagamentoNoGateway>();
  public falharCriacao = false;

  async criarPreferencia(nova: NovaPreferencia): Promise<Preferencia> {
    if (this.falharCriacao) throw new Error('gateway indisponível');
    this.preferencias.push(nova);
    return {
      preferenceId: `pref-${nova.cobrancaId}`,
      initPoint: `https://mp.test/checkout/${nova.cobrancaId}`,
    };
  }

  async consultarPagamento(id: string): Promise<PagamentoNoGateway> {
    const pagamento = this.pagamentos.get(id);
    if (!pagamento) throw new Error(`pagamento ${id} desconhecido`);
    return pagamento;
  }

  pagar(
    id: string,
    dados: Pick<PagamentoNoGateway, 'referenciaExterna' | 'valor'> & Partial<PagamentoNoGateway>,
  ): void {
    this.pagamentos.set(id, { id, status: 'approved', statusDetail: 'accredited', bruto: {}, ...dados });
  }
}
