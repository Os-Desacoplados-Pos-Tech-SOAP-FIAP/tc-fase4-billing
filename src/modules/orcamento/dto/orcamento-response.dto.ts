import { ApiProperty } from '@nestjs/swagger';

import {
  Orcamento,
  StatusOrcamento,
  TipoItemOrcamento,
} from '../../../domain/orcamento/entities/Orcamento';

export class ItemOrcamentoResponseDto {
  @ApiProperty() itemId!: string;
  @ApiProperty({ enum: TipoItemOrcamento }) tipo!: TipoItemOrcamento;
  @ApiProperty() referenciaId!: string;
  @ApiProperty() descricao!: string;
  @ApiProperty() quantidade!: number;
  @ApiProperty() valorUnitario!: number;
}

class ClienteOrcamentoResponseDto {
  @ApiProperty() nome!: string;
  @ApiProperty() email!: string;
}

export class OrcamentoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() osId!: string;
  @ApiProperty() numeroOs!: number;
  @ApiProperty({ type: ClienteOrcamentoResponseDto }) cliente!: ClienteOrcamentoResponseDto;
  @ApiProperty({ type: ItemOrcamentoResponseDto, isArray: true }) itens!: ItemOrcamentoResponseDto[];
  @ApiProperty() valorTotal!: number;
  @ApiProperty({ enum: StatusOrcamento }) status!: StatusOrcamento;
  @ApiProperty() validoAte!: Date;
  @ApiProperty({ nullable: true, type: Date }) decididoEm!: Date | null;
  @ApiProperty() criadoEm!: Date;
  @ApiProperty() atualizadoEm!: Date;

  static fromDomain(orcamento: Orcamento): OrcamentoResponseDto {
    return {
      id: orcamento.id.toValue(),
      osId: orcamento.osId,
      numeroOs: orcamento.numeroOs,
      cliente: orcamento.cliente,
      itens: orcamento.itens,
      valorTotal: orcamento.valorTotal,
      status: orcamento.status,
      validoAte: orcamento.validoAte,
      decididoEm: orcamento.decididoEm,
      criadoEm: orcamento.criadoEm,
      atualizadoEm: orcamento.atualizadoEm,
    };
  }
}
