import { ConfigBilling } from '../application/ports/config-billing';

const numeroOu = (valor: string | undefined, padrao: number): number =>
  valor === undefined || valor === '' ? padrao : Number(valor);

/** Valores já validados por validarAmbiente no boot. */
export function lerConfigBilling(env: NodeJS.ProcessEnv): ConfigBilling {
  const url = env.PUBLIC_BASE_URL || 'http://localhost:3004';
  return {
    validadeOrcamentoHoras: numeroOu(env.ORCAMENTO_VALIDADE_HORAS, 48),
    urlPublica: url.endsWith('/') ? url.slice(0, -1) : url,
    intervaloExpiracaoMs: numeroOu(env.ORCAMENTO_EXPIRACAO_INTERVALO_MS, 60_000),
    pagamentoFake: (env.PAYMENT_PROVIDER || 'fake') === 'fake',
  };
}
