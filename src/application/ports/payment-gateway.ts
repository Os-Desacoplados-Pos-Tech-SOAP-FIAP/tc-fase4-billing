export interface NovaPreferencia {
  /** Vai como external_reference: o webhook devolve este id. */
  cobrancaId: string;
  osId: string;
  numeroOs: number;
  valor: number;
}

export interface Preferencia {
  preferenceId: string;
  /** Link do Checkout Pro enviado ao cliente. */
  initPoint: string;
}

export interface PagamentoNoGateway {
  id: string;
  /** Status do Mercado Pago: approved, rejected, cancelled, pending, in_process… */
  status: string;
  statusDetail: string | null;
  referenciaExterna: string | null;
  valor: number;
  bruto: unknown;
}

export const STATUS_APROVADO = 'approved';
export const STATUS_RECUSADOS: ReadonlySet<string> = new Set(['rejected', 'cancelled']);

export interface IPaymentGateway {
  criarPreferencia(nova: NovaPreferencia): Promise<Preferencia>;
  /** Fonte da verdade do pagamento: o webhook só informa o id. */
  consultarPagamento(id: string): Promise<PagamentoNoGateway>;
}

/** Só existe com o gateway fake: registra um pagamento como se o cliente tivesse pago. */
export interface ISimuladorPagamento {
  registrarPagamento(dados: { referenciaExterna: string; valor: number; aprovado: boolean }): string;
}
