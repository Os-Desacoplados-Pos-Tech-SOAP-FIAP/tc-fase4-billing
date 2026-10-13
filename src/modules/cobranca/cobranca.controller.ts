import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ListarCobrancasUseCase } from '../../application/cobranca/listar-cobrancas/ListarCobrancasUseCase';
import { PerfilAcesso } from '../../common/auth/perfil';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiAuthResponses } from '../../common/decorators/swagger';
import { CobrancaResponseDto } from './dto/cobranca-response.dto';

@ApiTags('Cobranças')
@ApiBearerAuth()
@Roles(PerfilAcesso.ADMINISTRADOR, PerfilAcesso.ATENDENTE, PerfilAcesso.MECANICO)
@Controller('cobrancas')
export class CobrancaController {
  constructor(private readonly listar: ListarCobrancasUseCase) {}

  @Get(':osId')
  @ApiOperation({
    summary: 'Cobranças de uma OS',
    description: 'Histórico de links: recusadas, pendente e paga.',
  })
  @ApiResponse({ status: 200, type: CobrancaResponseDto, isArray: true })
  @ApiAuthResponses()
  async listarDaOs(@Param('osId', ParseUUIDPipe) osId: string): Promise<CobrancaResponseDto[]> {
    return (await this.listar.execute(osId)).map((c) => CobrancaResponseDto.fromDomain(c));
  }
}
