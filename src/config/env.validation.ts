const OBRIGATORIAS = ['DATABASE_URL', 'JWT_SECRET'];
const OBRIGATORIAS_MENSAGERIA = ['INBOX_QUEUE_URL', 'EVENTS_TOPIC_ARN'];

/** Falha no boot se faltar configuração, em vez de quebrar na primeira requisição. */
export function validarAmbiente(config: Record<string, unknown>): Record<string, unknown> {
  const exigidas =
    config.MESSAGING_ENABLED === 'false'
      ? OBRIGATORIAS
      : [...OBRIGATORIAS, ...OBRIGATORIAS_MENSAGERIA];
  const ausentes = exigidas.filter((chave) => !config[chave]);
  if (ausentes.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${ausentes.join(', ')}`);
  }
  return config;
}
