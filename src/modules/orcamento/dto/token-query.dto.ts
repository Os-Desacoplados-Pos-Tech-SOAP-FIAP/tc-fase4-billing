import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TokenQueryDto {
  @ApiProperty({ description: 'Token recebido no link do e-mail' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
