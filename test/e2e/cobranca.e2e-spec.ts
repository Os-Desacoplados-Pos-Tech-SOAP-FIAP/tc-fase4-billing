import { createHmac } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { BILLING_COMMANDS, BILLING_EVENTS } from '../../src/application/billing-messages';
import { criarEnvelope } from '../../src/application/ports/message-envelope';
import { Email } from '../../src/application/ports/notificador';
import { PerfilAcesso } from '../../src/common/auth/perfil';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { MessageHandlerRegistry } from '../../src/infrastructure/messaging/message-handler.registry';
import { FakePaymentGateway } from '../../src/infrastructure/payment/fake-payment.gateway';
import { OS, payloadOrcamento } from '../fakes/cenario';
import { criarApp } from '../helpers/app';
import { capturarEmails, tiposNaOutbox, tokenDoUltimoEmail } from '../helpers/billing';
import { limparBanco } from '../helpers/database';
import { token } from '../helpers/tokens';

const assinar = (dataId: string, requestId: string, ts: string) =>
  createHmac('sha256', process.env.MP_WEBHOOK_SECRET as string)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex');

describe('Cobrança e pagamento (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registry: MessageHandlerRegistry;
  let emails: Email[];
  const atendente = token(PerfilAcesso.ATENDENTE);
  const mecanico = token(PerfilAcesso.MECANICO);
  const http = () => request(app.getHttpServer());
  const simular = `/api/billing/dev/pagamentos/${OS}/simular`;
  const webhook = '/api/billing/webhooks/mercadopago';

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    registry = app.get(MessageHandlerRegistry);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    emails = capturarEmails(app);
    await registry.despachar(criarEnvelope(BILLING_COMMANDS.GERAR_ORCAMENTO, OS, payloadOrcamento()));
    await http()
      .post('/api/billing/publico/orcamentos/42/decisao')
      .send({ token: tokenDoUltimoEmail(emails), decisao: 'APROVADA' })
      .expect(200);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => app.close());

  const gerarCobranca = () =>
    registry.despachar(criarEnvelope(BILLING_COMMANDS.GERAR_COBRANCA, OS, {}));
  const cobrancas = async () =>
    (await http().get(`/api/billing/cobrancas/${OS}`).set('Authorization', atendente).expect(200))
      .body;
  const pagamentoAprovado = (cobranca: { id: string; valor: number }) =>
    app.get(FakePaymentGateway).registrarPagamento({
      referenciaExterna: cobranca.id,
      valor: cobranca.valor,
      aprovado: true,
    });

  it('recusa, novo link a pedido do orquestrador e pagamento aprovado', async () => {
    await gerarCobranca();
    const [pendente] = await cobrancas();
    expect(pendente).toMatchObject({ status: 'PENDENTE', valor: 165.5 });
    expect(emails.at(-1)!.corpo).toContain(pendente.initPoint);

    const recusa = await http()
      .post(simular)
      .set('Authorization', atendente)
      .send({ aprovado: false })
      .expect(200);
    expect(recusa.body.status).toBe('RECUSADA');

    await gerarCobranca();
    const aprovacao = await http()
      .post(simular)
      .set('Authorization', atendente)
      .send({ aprovado: true })
      .expect(200);
    expect(aprovacao.body.status).toBe('PAGA');

    expect((await cobrancas()).map((c: { status: string }) => c.status)).toEqual(['RECUSADA', 'PAGA']);
    expect(await tiposNaOutbox(prisma)).toEqual([
      BILLING_EVENTS.ORCAMENTO_ENVIADO,
      BILLING_EVENTS.ORCAMENTO_APROVADO,
      BILLING_EVENTS.COBRANCA_GERADA,
      BILLING_EVENTS.PAGAMENTO_RECUSADO,
      BILLING_EVENTS.COBRANCA_GERADA,
      BILLING_EVENTS.PAGAMENTO_CONFIRMADO,
    ]);
  });

  it('webhook: assinatura inválida é 401; válida processa o pagamento; outro tópico é ignorado', async () => {
    await gerarCobranca();
    const [pendente] = await cobrancas();
    const pagamentoId = pagamentoAprovado(pendente);
    const url = `${webhook}?data.id=${pagamentoId}&type=payment`;

    await http().post(url).set('x-signature', 'ts=1700,v1=00').set('x-request-id', 'req-1').send({}).expect(401);
    await http().post(url).set('x-request-id', 'req-1').send({}).expect(401);
    await http()
      .post(url)
      .set('x-signature', `ts=1700,v1=${assinar(pagamentoId, 'req-1', '1700')}`)
      .set('x-request-id', 'req-1')
      .send({ type: 'payment', data: { id: pagamentoId } })
      .expect(200, { recebido: true });
    expect((await cobrancas())[0].status).toBe('PAGA');

    await http()
      .post(`${webhook}?data.id=123&type=merchant_order`)
      .set('x-signature', `ts=1700,v1=${assinar('123', 'req-2', '1700')}`)
      .set('x-request-id', 'req-2')
      .send({})
      .expect(200);
    expect((await tiposNaOutbox(prisma)).at(-1)).toBe(BILLING_EVENTS.PAGAMENTO_CONFIRMADO);
  });

  it('webhook: o data.id da query string vale para a assinatura e para a consulta', async () => {
    await gerarCobranca();
    const [pendente] = await cobrancas();
    const pagamentoId = pagamentoAprovado(pendente);
    const assinatura = `ts=1700,v1=${assinar(pagamentoId, 'req-3', '1700')}`;

    // Assinado com o id do corpo, mas a query traz outro id: assinatura não confere.
    await http()
      .post(`${webhook}?data.id=outro&type=payment`)
      .set('x-signature', assinatura)
      .set('x-request-id', 'req-3')
      .send({ type: 'payment', data: { id: pagamentoId } })
      .expect(401);

    // Corpo divergente é ignorado: vale o id da query.
    await http()
      .post(`${webhook}?data.id=${pagamentoId}&type=payment`)
      .set('x-signature', assinatura)
      .set('x-request-id', 'req-3')
      .send({ type: 'payment', data: { id: 'outro' } })
      .expect(200);
    expect((await cobrancas())[0].status).toBe('PAGA');
  });

  it('webhook: sem query, usa o id e o tipo do corpo; pagamento inexistente é ignorado', async () => {
    await http()
      .post(webhook)
      .set('x-signature', `ts=1700,v1=${assinar('999', 'req-4', '1700')}`)
      .set('x-request-id', 'req-4')
      .send({ type: 'payment', data: { id: 999 } })
      .expect(200, { recebido: true });
    expect(await tiposNaOutbox(prisma)).toEqual([
      BILLING_EVENTS.ORCAMENTO_ENVIADO,
      BILLING_EVENTS.ORCAMENTO_APROVADO,
    ]);
  });

  it('simulação exige cobrança pendente e perfil de atendimento', async () => {
    await http().post(simular).set('Authorization', atendente).send({ aprovado: true }).expect(404);
    await http().post(simular).set('Authorization', mecanico).send({ aprovado: true }).expect(403);
    await http().post(simular).set('Authorization', atendente).send({}).expect(400);
  });

  it('listagem de cobranças exige funcionário e osId válido', async () => {
    await http().get(`/api/billing/cobrancas/${OS}`).expect(401);
    await http().get('/api/billing/cobrancas/nao-uuid').set('Authorization', mecanico).expect(400);
    expect(await cobrancas()).toEqual([]);
  });
});
