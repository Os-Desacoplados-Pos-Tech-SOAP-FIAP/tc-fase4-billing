import { ApiProperty } from '@nestjs/swagger';

import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';

export class CobrancaResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() osId!: string;
  @ApiProperty() orcamentoId!: string;
  @ApiProperty() valor!: number;
  @ApiProperty({ enum: StatusCobranca }) status!: StatusCobranca;
  @ApiProperty({ description: 'Link do Checkout Pro' }) initPoint!: string;
  @ApiProperty({ nullable: true, type: String }) mpPaymentId!: string | null;
  @ApiProperty() criadoEm!: Date;
  @ApiProperty() atualizadoEm!: Date;

  static fromDomain(cobranca: Cobranca): CobrancaResponseDto {
    return {
      id: cobranca.id.toValue(),
      osId: cobranca.osId,
      orcamentoId: cobranca.orcamentoId,
      valor: cobranca.valor,
      status: cobranca.status,
      initPoint: cobranca.initPoint,
      mpPaymentId: cobranca.mpPaymentId,
      criadoEm: cobranca.criadoEm,
      atualizadoEm: cobranca.atualizadoEm,
    };
  }
}
