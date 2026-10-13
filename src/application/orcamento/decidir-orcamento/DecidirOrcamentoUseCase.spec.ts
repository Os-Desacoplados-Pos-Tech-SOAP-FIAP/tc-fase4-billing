import { Cenario, criarCenario, OS, payloadOrcamento } from '../../../../test/fakes/cenario';
import { Orcamento, StatusOrcamento } from '../../../domain/orcamento/entities/Orcamento';
import { DomainError } from '../../../domain/shared/DomainError';
import { BILLING_EVENTS } from '../../billing-messages';
import { ConcorrenciaError, RecursoNaoEncontradoError } from '../../errors';
import { ConsultarOrcamentoPublicoUseCase } from '../consultar-orcamento-publico/ConsultarOrcamentoPublicoUseCase';
import { gerarTokenAprovacao } from '../token-aprovacao';
import { DecidirOrcamentoUseCase } from './DecidirOrcamentoUseCase';

describe('DecidirOrcamentoUseCase', () => {
  let c: Cenario;
  let useCase: DecidirOrcamentoUseCase;
  const { token, hash } = gerarTokenAprovacao();

  beforeEach(async () => {
    c = criarCenario();
    useCase = new DecidirOrcamentoUseCase(
      c.transacao,
      new ConsultarOrcamentoPublicoUseCase(c.orcamentos),
      c.orcamentos,
      c.outbox,
      c.relogio,
    );
    await c.orcamentos.salvar(
      Orcamento.criar({
        osId: OS,
        ...payloadOrcamento(),
        validoAte: new Date('2026-10-22T10:00:00Z'),
        tokenHash: hash,
      }),
    );
  });

  it('aprova e publica orcamento-aprovado sem causationId (veio do cliente)', async () => {
    const o = await useCase.execute({ numeroOs: 42, token, decisao: 'APROVADA' });
    expect(o.status).toBe(StatusOrcamento.APROVADO);
    expect((await c.orcamentos.buscarPorOs(OS))!.status).toBe(StatusOrcamento.APROVADO);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.ORCAMENTO_APROVADO,
      correlationId: OS,
      payload: { osId: OS, orcamentoId: o.id.toValue() },
    });
    expect(c.outbox.mensagens[0].causationId).toBeUndefined();
  });

  it('reprova e publica orcamento-reprovado', async () => {
    await useCase.execute({ numeroOs: 42, token, decisao: 'REPROVADA' });
    expect(c.outbox.tipos()).toEqual([BILLING_EVENTS.ORCAMENTO_REPROVADO]);
  });

  it('segunda decisão é recusada (uso único) e nada é publicado', async () => {
    await useCase.execute({ numeroOs: 42, token, decisao: 'APROVADA' });
    await expect(
      useCase.execute({ numeroOs: 42, token, decisao: 'REPROVADA' }),
    ).rejects.toMatchObject({ code: 'ORCAMENTO_JA_DECIDIDO' });
    expect(c.outbox.mensagens).toHaveLength(1);
  });

  it('decisão depois da validade é recusada', async () => {
    c.relogio.avancarHoras(49);
    const rejeitado = useCase.execute({ numeroOs: 42, token, decisao: 'APROVADA' });
    await expect(rejeitado).rejects.toBeInstanceOf(DomainError);
    await expect(rejeitado).rejects.toMatchObject({ code: 'ORCAMENTO_VENCIDO' });
  });

  it('conflito de versão ao salvar propaga ConcorrenciaError e nada é publicado', async () => {
    jest.spyOn(c.orcamentos, 'salvar').mockRejectedValueOnce(new ConcorrenciaError('Orçamento'));
    await expect(
      useCase.execute({ numeroOs: 42, token, decisao: 'APROVADA' }),
    ).rejects.toBeInstanceOf(ConcorrenciaError);
    expect(c.outbox.mensagens).toHaveLength(0);
  });

  it('token errado dá 404', async () => {
    await expect(
      useCase.execute({ numeroOs: 42, token: 'x', decisao: 'APROVADA' }),
    ).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
  });
});
