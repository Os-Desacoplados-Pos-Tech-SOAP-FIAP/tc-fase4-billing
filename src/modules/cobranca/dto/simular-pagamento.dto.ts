import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SimularPagamentoDto {
  @ApiProperty({ description: 'true = aprovado (APRO); false = recusado (OTHE)' })
  @IsBoolean()
  aprovado!: boolean;
}
