import { Cenario, criarCenario, OS } from '../../../../test/fakes/cenario';
import { Cobranca, StatusCobranca } from '../../../domain/cobranca/entities/Cobranca';
import { UniqueID } from '../../../domain/shared/UniqueID';
import { RecursoNaoEncontradoError } from '../../errors';
import { ISimuladorPagamento } from '../../ports/payment-gateway';
import { ProcessarNotificacaoPagamentoUseCase } from '../processar-notificacao-pagamento/ProcessarNotificacaoPagamentoUseCase';
import { SimularPagamentoUseCase } from './SimularPagamentoUseCase';

describe('SimularPagamentoUseCase', () => {
  let c: Cenario;
  let useCase: SimularPagamentoUseCase;

  beforeEach(() => {
    c = criarCenario();
    let sequencia = 0;
    const simulador: ISimuladorPagamento = {
      registrarPagamento: ({ referenciaExterna, valor, aprovado }) => {
        const id = `sim-${++sequencia}`;
        c.gateway.pagar(id, { referenciaExterna, valor, status: aprovado ? 'approved' : 'rejected' });
        return id;
      },
    };
    const processar = new ProcessarNotificacaoPagamentoUseCase(
      c.transacao,
      c.cobrancas,
      c.pagamentos,
      c.outbox,
      c.gateway,
    );
    useCase = new SimularPagamentoUseCase(c.cobrancas, simulador, processar);
  });

  it('paga a cobrança pendente da OS pelo mesmo caminho do webhook', async () => {
    await c.cobrancas.salvar(
      Cobranca.criar(
        { osId: OS, orcamentoId: OS, valor: 10, preferenceId: 'p', initPoint: 'i' },
        new UniqueID(),
      ),
    );
    const cobranca = await useCase.execute(OS, true);
    expect(cobranca.status).toBe(StatusCobranca.PAGA);
  });

  it('sem cobrança pendente responde 404', async () => {
    await expect(useCase.execute(OS, true)).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
  });
});
