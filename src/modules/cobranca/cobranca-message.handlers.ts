import { Injectable, OnModuleInit } from '@nestjs/common';

import { BILLING_COMMANDS } from '../../application/billing-messages';
import { GerarCobrancaUseCase } from '../../application/cobranca/gerar-cobranca/GerarCobrancaUseCase';
import { MessageHandlerRegistry } from '../../infrastructure/messaging/message-handler.registry';

@Injectable()
export class CobrancaMessageHandlers implements OnModuleInit {
  constructor(
    private readonly registry: MessageHandlerRegistry,
    private readonly gerar: GerarCobrancaUseCase,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(BILLING_COMMANDS.GERAR_COBRANCA, (envelope) =>
      this.gerar.execute({ messageId: envelope.messageId, correlationId: envelope.correlationId }),
    );
  }
}
