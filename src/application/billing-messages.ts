import { ClienteOrcamento, ItemOrcamento } from '../domain/orcamento/entities/Orcamento';

/** Comandos que o Billing recebe do orquestrador (OS Service). */
export const BILLING_COMMANDS = {
  GERAR_ORCAMENTO: 'billing.gerar-orcamento.v1',
  CANCELAR_ORCAMENTO: 'billing.cancelar-orcamento.v1',
  GERAR_COBRANCA: 'billing.gerar-cobranca.v1',
} as const;

/** Eventos que o Billing publica no tópico oficina-billing-events.fifo. */
export const BILLING_EVENTS = {
  ORCAMENTO_ENVIADO: 'billing.orcamento-enviado.v1',
  ORCAMENTO_APROVADO: 'billing.orcamento-aprovado.v1',
  ORCAMENTO_REPROVADO: 'billing.orcamento-reprovado.v1',
  ORCAMENTO_EXPIRADO: 'billing.orcamento-expirado.v1',
  ORCAMENTO_CANCELADO: 'billing.orcamento-cancelado.v1',
  COBRANCA_GERADA: 'billing.cobranca-gerada.v1',
  PAGAMENTO_CONFIRMADO: 'billing.pagamento-confirmado.v1',
  PAGAMENTO_RECUSADO: 'billing.pagamento-recusado.v1',
} as const;

export interface GerarOrcamentoPayload {
  numeroOs: number;
  cliente: ClienteOrcamento;
  itens: ItemOrcamento[];
}

export interface CancelarOrcamentoPayload {
  motivo?: string;
}

export interface OrcamentoEnviadoPayload {
  osId: string;
  orcamentoId: string;
  numeroOs: number;
  valorTotal: number;
  validoAte: string;
}

/** Aprovado, reprovado e expirado. */
export interface DecisaoOrcamentoPayload {
  osId: string;
  orcamentoId: string;
}

export interface OrcamentoCanceladoPayload {
  osId: string;
}

export interface CobrancaGeradaPayload {
  osId: string;
  cobrancaId: string;
  valor: number;
  initPoint: string;
}

export interface PagamentoConfirmadoPayload {
  osId: string;
  cobrancaId: string;
  mpPaymentId: string;
  valor: number;
}

export interface PagamentoRecusadoPayload {
  osId: string;
  cobrancaId: string;
  mpPaymentId: string;
  motivo: string;
}
