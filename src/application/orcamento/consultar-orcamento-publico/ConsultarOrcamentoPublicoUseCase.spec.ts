import { Cenario, criarCenario, OS, payloadOrcamento } from '../../../../test/fakes/cenario';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { RecursoNaoEncontradoError } from '../../errors';
import { gerarTokenAprovacao } from '../token-aprovacao';
import { ConsultarOrcamentoPublicoUseCase } from './ConsultarOrcamentoPublicoUseCase';

describe('ConsultarOrcamentoPublicoUseCase', () => {
  let c: Cenario;
  let useCase: ConsultarOrcamentoPublicoUseCase;
  const { token, hash } = gerarTokenAprovacao();

  beforeEach(async () => {
    c = criarCenario();
    useCase = new ConsultarOrcamentoPublicoUseCase(c.orcamentos);
    await c.orcamentos.salvar(
      Orcamento.criar({
        osId: OS,
        ...payloadOrcamento(),
        validoAte: new Date('2026-10-22T10:00:00Z'),
        tokenHash: hash,
      }),
    );
  });

  it('devolve o orçamento com o token certo', async () => {
    expect((await useCase.execute(42, token)).osId).toBe(OS);
  });

  it('token errado e OS inexistente dão a mesma resposta (404)', async () => {
    await expect(useCase.execute(42, 'errado')).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
    await expect(useCase.execute(99, token)).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
  });
});
