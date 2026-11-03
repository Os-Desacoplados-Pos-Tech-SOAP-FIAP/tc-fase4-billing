import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { ConsultarOrcamentoPublicoUseCase } from '../../application/orcamento/consultar-orcamento-publico/ConsultarOrcamentoPublicoUseCase';
import { DecidirOrcamentoUseCase } from '../../application/orcamento/decidir-orcamento/DecidirOrcamentoUseCase';
import { ConflitoError, RecursoNaoEncontradoError } from '../../application/errors';
import { Public } from '../../common/decorators/public.decorator';
import { ApiValidationResponses } from '../../common/decorators/swagger';
import { DomainError } from '../../domain/shared/DomainError';
import { DecidirOrcamentoDto } from './dto/decidir-orcamento.dto';
import { OrcamentoPublicoResponseDto } from './dto/orcamento-publico-response.dto';
import { paginaDaDecisao, paginaDeErro, paginaDoOrcamento } from './pagina/pagina-orcamento';

/**
 * Lê só o `token` da query: parâmetros extras (utm_*, fbclid) acrescentados por clientes de
 * e-mail são ignorados. Ausente, vazio ou repetido (vira array) → 400.
 */
function tokenDaQuery(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length === 0) {
    throw new BadRequestException('token é obrigatório');
  }
  return valor;
}

/** Navegador pede HTML; Postman, REST Client e o smoke pedem JSON (Accept ausente ou JSON). */
function navegador(accept: string | undefined): boolean {
  return accept?.includes('text/html') ?? false;
}

/** Botões da página: formulário HTML, que chega como application/x-www-form-urlencoded. */
function formulario(contentType: string | undefined): boolean {
  return contentType?.includes('application/x-www-form-urlencoded') ?? false;
}

/** Mesmos status do AllExceptionsFilter, com mensagem para o cliente. Erro inesperado sobe. */
function erroParaPagina(erro: unknown): { status: number; mensagem: string } {
  if (erro instanceof RecursoNaoEncontradoError) {
    return { status: 404, mensagem: 'Orçamento não encontrado. Confira se o link do e-mail está completo.' };
  }
  if (erro instanceof DomainError) return { status: 422, mensagem: erro.message };
  if (erro instanceof ConflitoError) {
    return { status: 409, mensagem: 'Outra decisão foi registrada ao mesmo tempo. Abra o link de novo.' };
  }
  if (erro instanceof HttpException) return { status: erro.getStatus(), mensagem: erro.message };
  throw erro;
}

/** A página leva o token na URL: sem cache e sem Referer para não vazá-lo. */
function prepararHtml(res: Response, status = 200): void {
  res.status(status).type('html').set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
}

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
  @ApiQuery({ name: 'token', required: true, description: 'Token recebido no link do e-mail' })
  @ApiResponse({ status: 400, description: 'Token ausente ou repetido' })
  @ApiResponse({ status: 200, type: OrcamentoPublicoResponseDto })
  @ApiResponse({ status: 404, description: 'OS inexistente ou token inválido' })
  @ApiProduces('application/json', 'text/html')
  async obter(
    @Param('numeroOs', ParseIntPipe) numeroOs: number,
    @Query('token') token: unknown,
    @Headers('accept') accept: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrcamentoPublicoResponseDto | string> {
    if (!navegador(accept)) {
      return OrcamentoPublicoResponseDto.fromDomain(await this.consultar.execute(numeroOs, tokenDaQuery(token)));
    }
    try {
      const valido = tokenDaQuery(token);
      const orcamento = OrcamentoPublicoResponseDto.fromDomain(await this.consultar.execute(numeroOs, valido));
      prepararHtml(res);
      return paginaDoOrcamento(orcamento, valido);
    } catch (erro) {
      const { status, mensagem } = erroParaPagina(erro);
      prepararHtml(res, status);
      return paginaDeErro(mensagem);
    }
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
  @ApiProduces('application/json', 'text/html')
  async registrarDecisao(
    @Param('numeroOs', ParseIntPipe) numeroOs: number,
    @Body() dto: DecidirOrcamentoDto,
    @Headers('content-type') contentType: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrcamentoPublicoResponseDto | string> {
    const decidir = async () =>
      OrcamentoPublicoResponseDto.fromDomain(
        await this.decidir.execute({ numeroOs, token: dto.token, decisao: dto.decisao }),
      );
    if (!formulario(contentType)) return decidir();
    try {
      const orcamento = await decidir();
      prepararHtml(res);
      return paginaDaDecisao(orcamento);
    } catch (erro) {
      const { status, mensagem } = erroParaPagina(erro);
      prepararHtml(res, status);
      return paginaDeErro(mensagem);
    }
  }
}
