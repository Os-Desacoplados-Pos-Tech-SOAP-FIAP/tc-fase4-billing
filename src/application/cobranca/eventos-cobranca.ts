import { Cobranca } from '../../domain/cobranca/entities/Cobranca';
import {
  BILLING_EVENTS,
  CobrancaGeradaPayload,
  PagamentoConfirmadoPayload,
  PagamentoRecusadoPayload,
} from '../billing-messages';
import { criarEnvelope, MessageEnvelope } from '../ports/message-envelope';

export function eventoCobrancaGerada(cobranca: Cobranca, causationId?: string): MessageEnvelope {
  return criarEnvelope<CobrancaGeradaPayload>(
    BILLING_EVENTS.COBRANCA_GERADA,
    cobranca.osId,
    {
      osId: cobranca.osId,
      cobrancaId: cobranca.id.toValue(),
      valor: cobranca.valor,
      initPoint: cobranca.initPoint,
    },
    causationId,
  );
}

export function eventoPagamentoConfirmado(cobranca: Cobranca, causationId?: string): MessageEnvelope {
  return criarEnvelope<PagamentoConfirmadoPayload>(
    BILLING_EVENTS.PAGAMENTO_CONFIRMADO,
    cobranca.osId,
    {
      osId: cobranca.osId,
      cobrancaId: cobranca.id.toValue(),
      mpPaymentId: cobranca.mpPaymentId ?? '',
      valor: cobranca.valor,
    },
    causationId,
  );
}

export function eventoPagamentoRecusado(cobranca: Cobranca, motivo: string): MessageEnvelope {
  return criarEnvelope<PagamentoRecusadoPayload>(
    BILLING_EVENTS.PAGAMENTO_RECUSADO,
    cobranca.osId,
    {
      osId: cobranca.osId,
      cobrancaId: cobranca.id.toValue(),
      mpPaymentId: cobranca.mpPaymentId ?? '',
      motivo,
    },
  );
}
