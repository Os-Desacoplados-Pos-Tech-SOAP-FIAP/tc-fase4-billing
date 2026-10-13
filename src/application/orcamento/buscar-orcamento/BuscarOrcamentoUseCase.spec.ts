import { Cenario, criarCenario, OS, payloadOrcamento } from '../../../../test/fakes/cenario';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { RecursoNaoEncontradoError } from '../../errors';
import { BuscarOrcamentoUseCase } from './BuscarOrcamentoUseCase';

describe('BuscarOrcamentoUseCase', () => {
  let c: Cenario;

  beforeEach(() => {
    c = criarCenario();
  });

  it('devolve o orçamento da OS ou 404', async () => {
    const useCase = new BuscarOrcamentoUseCase(c.orcamentos);
    await expect(useCase.execute(OS)).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
    await c.orcamentos.salvar(
      Orcamento.criar({
        osId: OS,
        ...payloadOrcamento(),
        validoAte: new Date('2026-10-22T10:00:00Z'),
        tokenHash: 'h',
      }),
    );
    expect((await useCase.execute(OS)).numeroOs).toBe(42);
  });
});
