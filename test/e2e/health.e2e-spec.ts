import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { criarApp } from '../helpers/app';

describe('Health (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await criarApp()));
  afterAll(() => app.close());

  it('GET /api/billing/health é público', async () => {
    await request(app.getHttpServer()).get('/api/billing/health').expect(200, { status: 'ok' });
  });

  it('Swagger publicado em /api/billing/docs', async () => {
    await request(app.getHttpServer()).get('/api/billing/docs').expect(200);
  });
});
