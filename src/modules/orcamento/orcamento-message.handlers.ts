import { Injectable, OnModuleInit } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { BILLING_COMMANDS } from '../../application/billing-messages';
import { CancelarOrcamentoUseCase } from '../../application/orcamento/cancelar-orcamento/CancelarOrcamentoUseCase';
import { GerarOrcamentoUseCase } from '../../application/orcamento/gerar-orcamento/GerarOrcamentoUseCase';
import { TipoItemOrcamento } from '../../domain/orcamento/entities/Orcamento';
import { MessageHandlerRegistry } from '../../infrastructure/messaging/message-handler.registry';
import { validarPayload } from '../../infrastructure/messaging/validar-payload';

class ClienteMensagem {
  @IsString() @IsNotEmpty() nome!: string;
  @IsEmail() email!: string;
}

class ItemOrcamentoMensagem {
  @IsUUID() itemId!: string;
  @IsEnum(TipoItemOrcamento) tipo!: TipoItemOrcamento;
  @IsUUID() referenciaId!: string;
  @IsString() @IsNotEmpty() descricao!: string;
  @IsInt() @Min(1) quantidade!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valorUnitario!: number;
}

class GerarOrcamentoMensagem {
  @IsInt() @Min(1) numeroOs!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => ClienteMensagem)
  cliente!: ClienteMensagem;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemOrcamentoMensagem)
  itens!: ItemOrcamentoMensagem[];
}

class CancelarOrcamentoMensagem {
  @IsOptional() @IsString() motivo?: string;
}

/** Liga os comandos de orçamento recebidos na fila aos casos de uso. */
@Injectable()
export class OrcamentoMessageHandlers implements OnModuleInit {
  constructor(
    private readonly registry: MessageHandlerRegistry,
    private readonly gerar: GerarOrcamentoUseCase,
    private readonly cancelar: CancelarOrcamentoUseCase,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(BILLING_COMMANDS.GERAR_ORCAMENTO, async (envelope) => {
      const payload = await validarPayload(GerarOrcamentoMensagem, envelope.payload);
      await this.gerar.execute({
        messageId: envelope.messageId,
        correlationId: envelope.correlationId,
        numeroOs: payload.numeroOs,
        cliente: { nome: payload.cliente.nome, email: payload.cliente.email },
        itens: payload.itens.map(
          ({ itemId, tipo, referenciaId, descricao, quantidade, valorUnitario }) => ({
            itemId,
            tipo,
            referenciaId,
            descricao,
            quantidade,
            valorUnitario,
          }),
        ),
      });
    });
    this.registry.registrar(BILLING_COMMANDS.CANCELAR_ORCAMENTO, async (envelope) => {
      const payload = await validarPayload(CancelarOrcamentoMensagem, envelope.payload);
      await this.cancelar.execute({
        messageId: envelope.messageId,
        correlationId: envelope.correlationId,
        motivo: payload.motivo,
      });
    });
  }
}
