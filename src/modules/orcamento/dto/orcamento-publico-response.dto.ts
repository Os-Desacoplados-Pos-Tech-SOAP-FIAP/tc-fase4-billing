import { ApiProperty } from '@nestjs/swagger';

import {
  Orcamento,
  StatusOrcamento,
  TipoItemOrcamento,
} from '../../../domain/orcamento/entities/Orcamento';

class ItemPublicoResponseDto {
  @ApiProperty({ enum: TipoItemOrcamento }) tipo!: TipoItemOrcamento;
  @ApiProperty() descricao!: string;
  @ApiProperty() quantidade!: number;
  @ApiProperty() valorUnitario!: number;
}

/** O que o cliente vê pelo link: sem e-mail, ids internos nem hash do token. */
export class OrcamentoPublicoResponseDto {
  @ApiProperty() numeroOs!: number;
  @ApiProperty() clienteNome!: string;
  @ApiProperty({ type: ItemPublicoResponseDto, isArray: true }) itens!: ItemPublicoResponseDto[];
  @ApiProperty() valorTotal!: number;
  @ApiProperty({ enum: StatusOrcamento }) status!: StatusOrcamento;
  @ApiProperty() validoAte!: Date;

  static fromDomain(orcamento: Orcamento): OrcamentoPublicoResponseDto {
    return {
      numeroOs: orcamento.numeroOs,
      clienteNome: orcamento.cliente.nome,
      itens: orcamento.itens.map(({ tipo, descricao, quantidade, valorUnitario }) => ({
        tipo,
        descricao,
        quantidade,
        valorUnitario,
      })),
      valorTotal: orcamento.valorTotal,
      status: orcamento.status,
      validoAte: orcamento.validoAte,
    };
  }
}
