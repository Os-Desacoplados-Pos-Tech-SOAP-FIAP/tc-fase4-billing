import 'reflect-metadata';
process.env.DATABASE_URL ??=
  'postgresql://billing:billing@localhost:5435/billing_test?schema=public';
process.env.JWT_SECRET ??= 'segredo-de-teste';
process.env.MESSAGING_ENABLED = 'false';
process.env.EVENTS_TOPIC_ARN ??=
  'arn:aws:sns:us-east-1:000000000000:oficina-billing-events.fifo';
process.env.INBOX_QUEUE_URL ??= 'http://localhost:4566/000000000000/oficina-billing-inbox.fifo';
process.env.PAYMENT_PROVIDER = 'fake';
process.env.MP_WEBHOOK_SECRET ??= 'segredo-webhook-teste';
process.env.PUBLIC_BASE_URL ??= 'http://localhost:3004';
process.env.ORCAMENTO_VALIDADE_HORAS ??= '48';
process.env.ORCAMENTO_EXPIRACAO_INTERVALO_MS = '0';
