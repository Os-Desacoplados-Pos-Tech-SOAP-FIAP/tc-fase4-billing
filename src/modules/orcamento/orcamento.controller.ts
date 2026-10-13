import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { BuscarOrcamentoUseCase } from '../../application/orcamento/buscar-orcamento/BuscarOrcamentoUseCase';
import { PerfilAcesso } from '../../common/auth/perfil';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiAuthResponses } from '../../common/decorators/swagger';
import { OrcamentoResponseDto } from './dto/orcamento-response.dto';

@ApiTags('Orçamentos')
@ApiBearerAuth()
@Roles(PerfilAcesso.ADMINISTRADOR, PerfilAcesso.ATENDENTE, PerfilAcesso.MECANICO)
@Controller('orcamentos')
export class OrcamentoController {
  constructor(private readonly buscar: BuscarOrcamentoUseCase) {}

  @Get(':osId')
  @ApiOperation({ summary: 'Orçamento de uma OS (visão interna)' })
  @ApiResponse({ status: 200, type: OrcamentoResponseDto })
  @ApiResponse({ status: 404, description: 'OS sem orçamento' })
  @ApiAuthResponses()
  async obter(@Param('osId', ParseUUIDPipe) osId: string): Promise<OrcamentoResponseDto> {
    return OrcamentoResponseDto.fromDomain(await this.buscar.execute(osId));
  }
}
