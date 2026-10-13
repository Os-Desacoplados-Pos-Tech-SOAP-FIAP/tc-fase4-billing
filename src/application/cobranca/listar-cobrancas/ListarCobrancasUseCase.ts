import { Inject, Injectable } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Cobranca } from '../../../domain/cobranca/entities/Cobranca';
import { ICobrancaRepository } from '../../../domain/cobranca/repositories/ICobrancaRepository';

@Injectable()
export class ListarCobrancasUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.COBRANCA_REPOSITORY)
    private readonly cobrancas: ICobrancaRepository,
  ) {}

  execute(osId: string): Promise<Cobranca[]> {
    return this.cobrancas.listarPorOs(osId);
  }
}
