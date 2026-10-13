import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { BILLING_COMMANDS, BILLING_EVENTS } from '../../src/application/billing-messages';
import { ConfigBilling } from '../../src/application/ports/config-billing';
import { criarEnvelope } from '../../src/application/ports/message-envelope';
import { Email } from '../../src/application/ports/notificador';
import { PerfilAcesso } from '../../src/common/auth/perfil';
import { INJECTION_TOKENS } from '../../src/common/constants/injection-tokens';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { MensagemInvalidaError } from '../../src/infrastructure/messaging/message-envelope.parser';
import { MessageHandlerRegistry } from '../../src/infrastructure/messaging/message-handler.registry';
import { ExpiradorDeOrcamentos } from '../../src/modules/orcamento/expirador-de-orcamentos';
import { OS, payloadOrcamento } from '../fakes/cenario';
import { criarApp } from '../helpers/app';
import { capturarEmails, tiposNaOutbox, tokenDoUltimoEmail } from '../helpers/billing';
import { limparBanco } from '../helpers/database';
import { token } from '../helpers/tokens';

describe('Orçamento (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registry: MessageHandlerRegistry;
  let emails: Email[];
  const atendente = token(PerfilAcesso.ATENDENTE);
  const cliente = token(PerfilAcesso.CLIENTE);
  const http = () => request(app.getHttpServer());
  const publico = '/api/billing/publico/orcamentos/42';

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    registry = app.get(MessageHandlerRegistry);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    emails = capturarEmails(app);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => app.close());

  const gerar = () =>
    registry.despachar(criarEnvelope(BILLING_COMMANDS.GERAR_ORCAMENTO, OS, payloadOrcamento()));

  it('no boot, a configuração do Billing vem do ambiente', () => {
    expect(app.get<ConfigBilling>(INJECTION_TOKENS.CONFIG_BILLING)).toEqual({
      validadeOrcamentoHoras: 48,
      urlPublica: 'http://localhost:3004',
      intervaloExpiracaoMs: 0,
      pagamentoFake: true,
    });
  });

  it('gera, cliente consulta pelo link e aprova uma única vez', async () => {
    await gerar();
    expect(emails.at(-1)!.corpo).toContain(`http://localhost:3004${publico}?token=`);
    const t = tokenDoUltimoEmail(emails);

    const consulta = await http().get(`${publico}?token=${t}`).expect(200);
    expect(consulta.body).toMatchObject({
      numeroOs: 42,
      clienteNome: 'Maria',
      status: 'ENVIADO',
      valorTotal: 165.5,
    });
    expect(JSON.stringify(consulta.body)).not.toContain('maria@example.com');
    await http().get(`${publico}?token=errado`).expect(404);
    await http().get(publico).expect(400);
    // Fora do INT4 do Postgres: 404 (não revela quais OS existem), nunca 500.
    const foraDoInt4 = "/api/billing/publico/orcamentos/99999999999";
    await http().get(`${foraDoInt4}?token=${t}`).expect(404);
    await http().post(`${foraDoInt4}/decisao`).send({ token: t, decisao: "APROVADA" }).expect(404);

    const decisao = await http()
      .post(`${publico}/decisao`)
      .send({ token: t, decisao: 'APROVADA' })
      .expect(200);
    expect(decisao.body.status).toBe('APROVADO');
    const repetida = await http()
      .post(`${publico}/decisao`)
      .send({ token: t, decisao: 'REPROVADA' })
      .expect(422);
    expect(repetida.body).toMatchObject({
      code: 'ORCAMENTO_JA_DECIDIDO',
      message: 'Orçamento não aceita decisão: está APROVADO',
    });
    await http().post(`${publico}/decisao`).send({ token: t, decisao: 'TALVEZ' }).expect(400);

    expect(await tiposNaOutbox(prisma)).toEqual([
      BILLING_EVENTS.ORCAMENTO_ENVIADO,
      BILLING_EVENTS.ORCAMENTO_APROVADO,
    ]);
    const interno = await http()
      .get(`/api/billing/orcamentos/${OS}`)
      .set('Authorization', atendente)
      .expect(200);
    expect(interno.body).toMatchObject({
      osId: OS,
      status: 'APROVADO',
      cliente: { email: 'maria@example.com' },
    });
  });

  it('cliente reprova pelo link', async () => {
    await gerar();
    const decisao = await http()
      .post(`${publico}/decisao`)
      .send({ token: tokenDoUltimoEmail(emails), decisao: 'REPROVADA' })
      .expect(200);
    expect(decisao.body.status).toBe('REPROVADO');
    expect((await tiposNaOutbox(prisma)).at(-1)).toBe(BILLING_EVENTS.ORCAMENTO_REPROVADO);
  });

  it('compensação cancela o orçamento aprovado e avisa o cliente', async () => {
    await gerar();
    await http()
      .post(`${publico}/decisao`)
      .send({ token: tokenDoUltimoEmail(emails), decisao: 'APROVADA' })
      .expect(200);

    await registry.despachar(
      criarEnvelope(BILLING_COMMANDS.CANCELAR_ORCAMENTO, OS, { motivo: 'sem estoque' }),
    );

    const interno = await http()
      .get(`/api/billing/orcamentos/${OS}`)
      .set('Authorization', atendente)
      .expect(200);
    expect(interno.body.status).toBe('CANCELADO');
    expect((await tiposNaOutbox(prisma)).at(-1)).toBe(BILLING_EVENTS.ORCAMENTO_CANCELADO);
    expect(emails.at(-1)!.corpo).toContain('sem estoque');
  });

  it('expira o orçamento vencido', async () => {
    await gerar();
    const t = tokenDoUltimoEmail(emails);
    await prisma.orcamento.updateMany({ data: { validoAte: new Date(Date.now() - 1000) } });

    await app.get(ExpiradorDeOrcamentos).executarCiclo();

    expect((await tiposNaOutbox(prisma)).at(-1)).toBe(BILLING_EVENTS.ORCAMENTO_EXPIRADO);
    expect((await http().get(`${publico}?token=${t}`).expect(200)).body.status).toBe('EXPIRADO');
  });

  it('payload inválido vai para a DLQ', async () => {
    await expect(
      registry.despachar(
        criarEnvelope(BILLING_COMMANDS.GERAR_ORCAMENTO, OS, { ...payloadOrcamento(), itens: [] }),
      ),
    ).rejects.toBeInstanceOf(MensagemInvalidaError);
    await expect(
      registry.despachar(
        criarEnvelope(BILLING_COMMANDS.GERAR_ORCAMENTO, OS, {
          ...payloadOrcamento(),
          cliente: { nome: 'Maria', email: 'invalido' },
        }),
      ),
    ).rejects.toBeInstanceOf(MensagemInvalidaError);
    await expect(
      registry.despachar(criarEnvelope(BILLING_COMMANDS.CANCELAR_ORCAMENTO, OS, { motivo: 1 })),
    ).rejects.toBeInstanceOf(MensagemInvalidaError);
  });

  it('visão interna exige funcionário', async () => {
    await http().get(`/api/billing/orcamentos/${OS}`).expect(401);
    await http().get(`/api/billing/orcamentos/${OS}`).set('Authorization', cliente).expect(403);
    await http().get('/api/billing/orcamentos/nao-uuid').set('Authorization', atendente).expect(400);
    await http().get(`/api/billing/orcamentos/${OS}`).set('Authorization', atendente).expect(404);
  });

  it('link público ignora parâmetros extras e rejeita token ausente ou duplicado', async () => {
    await gerar();
    const t = tokenDoUltimoEmail(emails);

    await http().get(`${publico}?token=${t}&utm_source=email&fbclid=abc`).expect(200);
    await http().get(publico).expect(400);
    await http().get(`${publico}?token=`).expect(400);
    await http().get(`${publico}?token=${t}&token=${t}`).expect(400);
  });

  it('tolerant reader: campo extra no item da mensagem não é persistido', async () => {
    const base = payloadOrcamento();
    await registry.despachar(
      criarEnvelope(BILLING_COMMANDS.GERAR_ORCAMENTO, OS, {
        ...base,
        itens: base.itens.map((item) => ({ ...item, campoExtra: 'x' })),
      }),
    );
    const interno = await http()
      .get(`/api/billing/orcamentos/${OS}`)
      .set('Authorization', atendente)
      .expect(200);
    expect(interno.body.itens).toHaveLength(2);
    expect(interno.body.itens.every((item: object) => !('campoExtra' in item))).toBe(true);
  });
});
