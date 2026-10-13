import { Cenario, criarCenario, OS, payloadOrcamento } from '../../../../test/fakes/cenario';
import { Orcamento, StatusOrcamento } from '../../../domain/orcamento/entities/Orcamento';
import { BILLING_EVENTS } from '../../billing-messages';
import { CancelarOrcamentoUseCase } from './CancelarOrcamentoUseCase';

describe('CancelarOrcamentoUseCase', () => {
  let c: Cenario;
  let useCase: CancelarOrcamentoUseCase;
  const comando = (messageId = 'cmp-1', motivo?: string) => ({
    messageId,
    correlationId: OS,
    motivo,
  });

  const gravarOrcamento = async (decidir?: (o: Orcamento) => void) => {
    const o = Orcamento.criar({
      osId: OS,
      ...payloadOrcamento(),
      validoAte: new Date('2026-10-22T10:00:00Z'),
      tokenHash: 'h',
    });
    decidir?.(o);
    await c.orcamentos.salvar(o);
  };

  beforeEach(() => {
    c = criarCenario();
    useCase = new CancelarOrcamentoUseCase(
      c.transacao,
      c.processadas,
      c.orcamentos,
      c.outbox,
      c.notificador,
    );
  });

  it('cancela orçamento aprovado, confirma e avisa o cliente com o motivo', async () => {
    await gravarOrcamento((o) => o.aprovar(c.relogio.agora()));
    await useCase.execute(comando('cmp-1', 'sem estoque'));

    expect((await c.orcamentos.buscarPorOs(OS))!.status).toBe(StatusOrcamento.CANCELADO);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.ORCAMENTO_CANCELADO,
      causationId: 'cmp-1',
      payload: { osId: OS },
    });
    expect(c.notificador.emails[0].corpo).toContain('sem estoque');
  });

  it('cancela orçamento ainda ENVIADO, publica e avisa o cliente', async () => {
    await gravarOrcamento();
    await useCase.execute(comando());
    expect((await c.orcamentos.buscarPorOs(OS))!.status).toBe(StatusOrcamento.CANCELADO);
    expect(c.outbox.tipos()).toEqual([BILLING_EVENTS.ORCAMENTO_CANCELADO]);
    expect(c.notificador.emails).toHaveLength(1);
  });

  it('com outro messageId sobre orçamento já cancelado, publica de novo sem novo e-mail', async () => {
    await gravarOrcamento((o) => o.cancelar());
    await useCase.execute(comando('cmp-2'));
    expect(c.outbox.mensagens).toHaveLength(1);
    expect(c.outbox.mensagens[0]).toMatchObject({
      type: BILLING_EVENTS.ORCAMENTO_CANCELADO,
      causationId: 'cmp-2',
    });
    expect(c.notificador.emails).toHaveLength(0);
  });

  it('confirma mesmo sem orçamento (compensação sempre responde)', async () => {
    await useCase.execute(comando());
    expect(c.outbox.tipos()).toEqual([BILLING_EVENTS.ORCAMENTO_CANCELADO]);
    expect(c.notificador.emails).toHaveLength(0);
  });

  it('orçamento reprovado continua reprovado e a compensação é confirmada', async () => {
    await gravarOrcamento((o) => o.reprovar(c.relogio.agora()));
    await useCase.execute(comando());
    expect((await c.orcamentos.buscarPorOs(OS))!.status).toBe(StatusOrcamento.REPROVADO);
    expect(c.outbox.tipos()).toEqual([BILLING_EVENTS.ORCAMENTO_CANCELADO]);
    expect(c.notificador.emails).toHaveLength(0);
  });

  it('é idempotente por messageId', async () => {
    await gravarOrcamento((o) => o.aprovar(c.relogio.agora()));
    await useCase.execute(comando());
    await useCase.execute(comando());
    expect(c.outbox.mensagens).toHaveLength(1);
    expect(c.notificador.emails).toHaveLength(1);
  });
});
