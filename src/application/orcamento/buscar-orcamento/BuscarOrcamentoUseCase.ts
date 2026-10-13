import { Inject, Injectable } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { ensureFound } from '../../ensure-found';

@Injectable()
export class BuscarOrcamentoUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
  ) {}

  async execute(osId: string): Promise<Orcamento> {
    return ensureFound(await this.orcamentos.buscarPorOs(osId), 'Orçamento');
  }
}
