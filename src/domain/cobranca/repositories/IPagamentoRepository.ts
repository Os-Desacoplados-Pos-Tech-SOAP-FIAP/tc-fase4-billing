export interface RegistroPagamento {
  mpPaymentId: string;
  cobrancaId: string;
  status: string;
  valor: number;
  payloadBruto: unknown;
}

/** Trilha de auditoria: guarda cada pagamento informado pelo gateway (upsert pelo id). */
export interface IPagamentoRepository {
  registrar(pagamento: RegistroPagamento): Promise<void>;
}
