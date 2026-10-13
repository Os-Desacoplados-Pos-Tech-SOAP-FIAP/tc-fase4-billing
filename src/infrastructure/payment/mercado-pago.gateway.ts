import { RecursoNaoEncontradoError } from '../../application/errors';
import {
  IPaymentGateway,
  NovaPreferencia,
  PagamentoNoGateway,
  Preferencia,
} from '../../application/ports/payment-gateway';
import { PaymentConfig } from './payment.config';

/** Abaixo dos 22 s que o Mercado Pago espera pela resposta do webhook. */
const TIMEOUT_MS = 5_000;

type Json = Record<string, unknown>;

const textoOuNull = (valor: unknown): string | null =>
  typeof valor === 'string' && valor !== '' ? valor : null;

/**
 * Checkout Pro pela API REST (sem SDK): POST /checkout/preferences e GET /v1/payments/:id.
 * Sem payer.email: em ambiente de teste, e-mail real de comprador é recusado.
 */
export class MercadoPagoGateway implements IPaymentGateway {
  constructor(
    private readonly config: PaymentConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async criarPreferencia(nova: NovaPreferencia): Promise<Preferencia> {
    const corpo = await this.chamar('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': nova.cobrancaId },
      body: JSON.stringify({
        items: [
          {
            id: nova.osId,
            title: `Ordem de serviço #${nova.numeroOs}`,
            quantity: 1,
            unit_price: nova.valor,
            currency_id: 'BRL',
          },
        ],
        external_reference: nova.cobrancaId,
        notification_url: this.config.notificationUrl,
      }),
    });
    return { preferenceId: String(corpo.id), initPoint: String(corpo.init_point) };
  }

  async consultarPagamento(id: string): Promise<PagamentoNoGateway> {
    const corpo = await this.chamar(`/v1/payments/${encodeURIComponent(id)}`, { method: 'GET' });
    return {
      id: String(corpo.id),
      status: String(corpo.status),
      statusDetail: textoOuNull(corpo.status_detail),
      referenciaExterna: textoOuNull(corpo.external_reference),
      valor: Number(corpo.transaction_amount ?? 0),
      bruto: corpo,
    };
  }

  private async chamar(caminho: string, init: RequestInit): Promise<Json> {
    const resposta = await this.fetcher(`${this.config.apiUrl}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (resposta.status === 404) throw new RecursoNaoEncontradoError('Pagamento');
    if (!resposta.ok) {
      throw new Error(`Mercado Pago respondeu ${resposta.status} em ${caminho}`);
    }
    return (await resposta.json()) as Json;
  }
}
