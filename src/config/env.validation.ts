const OBRIGATORIAS = ['DATABASE_URL', 'JWT_SECRET'];
const OBRIGATORIAS_MENSAGERIA = ['INBOX_QUEUE_URL', 'EVENTS_TOPIC_ARN'];
const OBRIGATORIAS_MERCADO_PAGO = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'MP_NOTIFICATION_URL'];
const PROVEDORES = ['fake', 'mercadopago'];

function exigirAusentes(config: Record<string, unknown>, chaves: string[]): void {
  const ausentes = chaves.filter((chave) => !config[chave]);
  if (ausentes.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${ausentes.join(', ')}`);
  }
}

function exigirInteiro(config: Record<string, unknown>, chave: string, minimo: number): void {
  const valor = config[chave];
  if (valor === undefined || valor === '') return;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo) {
    throw new Error(`${chave} deve ser inteiro maior ou igual a ${minimo}`);
  }
}

/** Falha no boot se faltar configuração, em vez de quebrar na primeira requisição. */
export function validarAmbiente(config: Record<string, unknown>): Record<string, unknown> {
  exigirAusentes(
    config,
    config.MESSAGING_ENABLED === 'false'
      ? OBRIGATORIAS
      : [...OBRIGATORIAS, ...OBRIGATORIAS_MENSAGERIA],
  );

  const provedor = (config.PAYMENT_PROVIDER as string | undefined) ?? 'fake';
  if (!PROVEDORES.includes(provedor)) {
    throw new Error(`PAYMENT_PROVIDER deve ser um de: ${PROVEDORES.join(', ')}`);
  }
  if (provedor === 'mercadopago') exigirAusentes(config, OBRIGATORIAS_MERCADO_PAGO);

  exigirInteiro(config, 'ORCAMENTO_VALIDADE_HORAS', 1);
  exigirInteiro(config, 'ORCAMENTO_EXPIRACAO_INTERVALO_MS', 0);
  return config;
}
