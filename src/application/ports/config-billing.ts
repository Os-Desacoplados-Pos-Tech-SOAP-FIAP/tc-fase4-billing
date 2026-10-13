export interface ConfigBilling {
  validadeOrcamentoHoras: number;
  /** Base dos links enviados ao cliente (API Gateway na AWS). */
  urlPublica: string;
  /** 0 desliga o worker de expiração. */
  intervaloExpiracaoMs: number;
  pagamentoFake: boolean;
}
