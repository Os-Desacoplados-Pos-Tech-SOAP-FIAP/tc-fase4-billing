import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ConsultarOrcamentoPublicoUseCase } from '../../application/orcamento/consultar-orcamento-publico/ConsultarOrcamentoPublicoUseCase';
import { DecidirOrcamentoUseCase } from '../../application/orcamento/decidir-orcamento/DecidirOrcamentoUseCase';
import { Public } from '../../common/decorators/public.decorator';
import { ApiValidationResponses } from '../../common/decorators/swagger';
import { DecidirOrcamentoDto } from './dto/decidir-orcamento.dto';
import { OrcamentoPublicoResponseDto } from './dto/orcamento-publico-response.dto';
import { TokenQueryDto } from './dto/token-query.dto';

/** Rotas do link enviado por e-mail: sem JWT, autorizadas pelo token do orçamento. */
@ApiTags('Orçamento (cliente)')
@Public()
@Controller('publico/orcamentos')
export class OrcamentoPublicoController {
  constructor(
    private readonly consultar: ConsultarOrcamentoPublicoUseCase,
    private readonly decidir: DecidirOrcamentoUseCase,
  ) {}

  @Get(':numeroOs')
  @ApiOperation({
    summary: 'Orçamento pelo link do e-mail',
    description: 'Token errado ou OS inexistente respondem 404 (não revela quais OS existem).',
  })
  @ApiResponse({ status: 200, type: OrcamentoPublicoResponseDto })
  @ApiResponse({ status: 404, description: 'OS inexistente ou token inválido' })
  async obter(
    @Param('numeroOs', ParseIntPipe) numeroOs: number,
    @Query() query: TokenQueryDto,
  ): Promise<OrcamentoPublicoResponseDto> {
    return OrcamentoPublicoResponseDto.fromDomain(await this.consultar.execute(numeroOs, query.token));
  }

  @Post(':numeroOs/decisao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Aprovar ou reprovar o orçamento',
    description: 'Uso único: só um orçamento ENVIADO e dentro da validade aceita decisão.',
  })
  @ApiResponse({ status: 200, type: OrcamentoPublicoResponseDto })
  @ApiResponse({ status: 404, description: 'OS inexistente ou token inválido' })
  @ApiResponse({ status: 409, description: 'Decisão concorrente (outra aba ou expiração)' })
  @ApiResponse({ status: 422, description: 'Orçamento já decidido, expirado ou cancelado' })
  @ApiValidationResponses()
  async registrarDecisao(
    @Param('numeroOs', ParseIntPipe) numeroOs: number,
    @Body() dto: DecidirOrcamentoDto,
  ): Promise<OrcamentoPublicoResponseDto> {
    const orcamento = await this.decidir.execute({ numeroOs, token: dto.token, decisao: dto.decisao });
    return OrcamentoPublicoResponseDto.fromDomain(orcamento);
  }
}
