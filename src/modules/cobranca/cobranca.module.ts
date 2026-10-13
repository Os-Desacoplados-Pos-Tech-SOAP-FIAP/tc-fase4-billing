import { Module } from '@nestjs/common';

import { GerarCobrancaUseCase } from '../../application/cobranca/gerar-cobranca/GerarCobrancaUseCase';
import { ListarCobrancasUseCase } from '../../application/cobranca/listar-cobrancas/ListarCobrancasUseCase';
import { ProcessarNotificacaoPagamentoUseCase } from '../../application/cobranca/processar-notificacao-pagamento/ProcessarNotificacaoPagamentoUseCase';
import { SimularPagamentoUseCase } from '../../application/cobranca/simular-pagamento/SimularPagamentoUseCase';
import { CobrancaMessageHandlers } from './cobranca-message.handlers';
import { CobrancaController } from './cobranca.controller';
import { DevPagamentosController } from './dev-pagamentos.controller';
import { WebhookMercadoPagoController } from './webhook-mercado-pago.controller';

@Module({
  controllers: [CobrancaController, WebhookMercadoPagoController, DevPagamentosController],
  providers: [
    GerarCobrancaUseCase,
    ProcessarNotificacaoPagamentoUseCase,
    ListarCobrancasUseCase,
    SimularPagamentoUseCase,
    CobrancaMessageHandlers,
  ],
})
export class CobrancaModule {}
