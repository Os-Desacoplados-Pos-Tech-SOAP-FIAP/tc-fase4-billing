import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

import { Decisao, DECISOES } from '../../../application/orcamento/decidir-orcamento/DecidirOrcamentoUseCase';

export class DecidirOrcamentoDto {
  @ApiProperty({ description: 'Token recebido no link do e-mail' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ enum: DECISOES })
  @IsIn(DECISOES)
  decisao!: Decisao;
}
