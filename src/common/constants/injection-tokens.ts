export const INJECTION_TOKENS = {
  ORCAMENTO_REPOSITORY: Symbol('IOrcamentoRepository'),
  COBRANCA_REPOSITORY: Symbol('ICobrancaRepository'),
  PAGAMENTO_REPOSITORY: Symbol('IPagamentoRepository'),
  PROCESSED_MESSAGE_REPOSITORY: Symbol('IProcessedMessageRepository'),
  OUTBOX: Symbol('IOutbox'),
  TRANSACTION_MANAGER: Symbol('ITransactionManager'),
  PAYMENT_GATEWAY: Symbol('IPaymentGateway'),
  SIMULADOR_PAGAMENTO: Symbol('ISimuladorPagamento'),
  NOTIFICADOR: Symbol('INotificador'),
  RELOGIO: Symbol('IRelogio'),
  CONFIG_BILLING: Symbol('ConfigBilling'),
} as const;
