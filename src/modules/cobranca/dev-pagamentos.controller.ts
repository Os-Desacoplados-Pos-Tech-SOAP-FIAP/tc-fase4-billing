import {
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { SimularPagamentoUseCase } from '../../application/cobranca/simular-pagamento/SimularPagamentoUseCase';
import { ConfigBilling } from '../../application/ports/config-billing';
import { PerfilAcesso } from '../../common/auth/perfil';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiAuthResponses } from '../../common/decorators/swagger';
import { CobrancaResponseDto } from './dto/cobranca-response.dto';
import { SimularPagamentoDto } from './dto/simular-pagamento.dto';

/** Fluxo local sem Mercado Pago. Com PAYMENT_PROVIDER=mercadopago a rota responde 404. */
@ApiTags('Dev')
@ApiBearerAuth()
@Roles(PerfilAcesso.ADMINISTRADOR, PerfilAcesso.ATENDENTE)
@Controller('dev/pagamentos')
export class DevPagamentosController {
  constructor(
    private readonly simularPagamento: SimularPagamentoUseCase,
    @Inject(INJECTION_TOKENS.CONFIG_BILLING) private readonly config: ConfigBilling,
  ) {}

  @Post(':osId/simular')
  @HttpCode(200)
  @ApiOperation({ summary: 'Simula o pagamento da cobrança pendente (só PAYMENT_PROVIDER=fake)' })
  @ApiResponse({ status: 200, type: CobrancaResponseDto })
  @ApiResponse({ status: 404, description: 'Sem cobrança pendente ou provedor real ativo' })
  @ApiAuthResponses()
  async simular(
    @Param('osId', ParseUUIDPipe) osId: string,
    @Body() dto: SimularPagamentoDto,
  ): Promise<CobrancaResponseDto> {
    if (!this.config.pagamentoFake) throw new NotFoundException();
    return CobrancaResponseDto.fromDomain(await this.simularPagamento.execute(osId, dto.aprovado));
  }
}
