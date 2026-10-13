import { Inject, Injectable } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { RecursoNaoEncontradoError } from '../../errors';
import { tokenConfere } from '../token-aprovacao';

/** Acesso do cliente pelo link do e-mail. Token errado responde como OS inexistente. */
@Injectable()
export class ConsultarOrcamentoPublicoUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
  ) {}

  async execute(numeroOs: number, token: string): Promise<Orcamento> {
    const orcamento = await this.orcamentos.buscarPorNumeroOs(numeroOs);
    if (!orcamento || !tokenConfere(token, orcamento.tokenHash)) {
      throw new RecursoNaoEncontradoError('Orçamento');
    }
    return orcamento;
  }
}
