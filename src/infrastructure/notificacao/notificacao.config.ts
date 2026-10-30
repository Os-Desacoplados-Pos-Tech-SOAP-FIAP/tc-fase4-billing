export const NOTIFICACAO_CONFIG = Symbol('NotificacaoConfig');

export interface NotificacaoConfig {
  /** console (padrão: log estruturado) ou ses (Amazon SES). */
  notificador: 'console' | 'ses';
  /** Identidade verificada no SES. Obrigatória com ses (validada no boot). */
  remetente: string;
}

export function lerNotificacaoConfig(env: NodeJS.ProcessEnv): NotificacaoConfig {
  return {
    notificador: env.NOTIFICADOR === 'ses' ? 'ses' : 'console',
    remetente: env.SES_REMETENTE ?? '',
  };
}
