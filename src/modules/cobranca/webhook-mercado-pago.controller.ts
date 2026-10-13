import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ProcessarNotificacaoPagamentoUseCase } from '../../application/cobranca/processar-notificacao-pagamento/ProcessarNotificacaoPagamentoUseCase';
import { Public } from '../../common/decorators/public.decorator';
import { assinaturaMercadoPagoValida } from '../../infrastructure/payment/assinatura-mercado-pago';
import { PAYMENT_CONFIG, PaymentConfig } from '../../infrastructure/payment/payment.config';

interface NotificacaoMercadoPago {
  type?: string;
  data?: { id?: string | number };
}

/**
 * Webhook "Pagamentos" do Mercado Pago. A assinatura prova a origem; o status do
 * pagamento vem da consulta à API, nunca do corpo. Erro responde 5xx/409 e o Mercado Pago reenvia.
 * O manifesto da assinatura usa o `data.id` da query string (o corpo só é fallback).
 */
@ApiTags('Webhooks')
@Public()
@Controller('webhooks')
export class WebhookMercadoPagoController {
  private readonly logger = new Logger(WebhookMercadoPagoController.name);

  constructor(
    private readonly processar: ProcessarNotificacaoPagamentoUseCase,
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
  ) {}

  @Post('mercadopago')
  @HttpCode(200)
  @ApiOperation({ summary: 'Notificação de pagamento do Mercado Pago (validada por x-signature)' })
  @ApiResponse({ status: 200, description: 'Recebida (processada ou ignorada)' })
  @ApiResponse({ status: 401, description: 'Assinatura inválida' })
  async receber(
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Query() query: Record<string, string>,
    @Body() corpo: NotificacaoMercadoPago,
  ): Promise<{ recebido: true }> {
    const idDoCorpo = corpo?.data?.id;
    const dataId = query['data.id'] ?? (idDoCorpo === undefined ? undefined : String(idDoCorpo));
    const assinaturaOk = assinaturaMercadoPagoValida({
      xSignature,
      xRequestId,
      dataId,
      segredo: this.config.webhookSecret,
    });
    if (!assinaturaOk) throw new UnauthorizedException('Assinatura inválida');

    const tipo = query.type ?? query.topic ?? corpo?.type;
    if (tipo !== 'payment' || !dataId) {
      this.logger.log({ msg: 'Notificação do Mercado Pago ignorada', tipo });
      return { recebido: true };
    }
    await this.processar.execute(dataId);
    return { recebido: true };
  }
}
