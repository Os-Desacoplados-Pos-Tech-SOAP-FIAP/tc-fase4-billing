import { Cenario, criarCenario, OS } from '../../../../test/fakes/cenario';
import { Cobranca } from '../../../domain/cobranca/entities/Cobranca';
import { UniqueID } from '../../../domain/shared/UniqueID';
import { ListarCobrancasUseCase } from './ListarCobrancasUseCase';

describe('ListarCobrancasUseCase', () => {
  let c: Cenario;

  beforeEach(() => {
    c = criarCenario();
  });

  it('lista as cobranças da OS', async () => {
    await c.cobrancas.salvar(
      Cobranca.criar(
        { osId: OS, orcamentoId: OS, valor: 10, preferenceId: 'p', initPoint: 'i' },
        new UniqueID(),
      ),
    );
    expect(await new ListarCobrancasUseCase(c.cobrancas).execute(OS)).toHaveLength(1);
  });
});
