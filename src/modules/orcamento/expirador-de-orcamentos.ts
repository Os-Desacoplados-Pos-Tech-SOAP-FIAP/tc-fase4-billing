import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';

import { ExpirarOrcamentosUseCase } from '../../application/orcamento/expirar-orcamentos/ExpirarOrcamentosUseCase';
import { ConfigBilling } from '../../application/ports/config-billing';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';
import { erroParaLog } from '../../infrastructure/messaging/erro-para-log';

/**
 * Worker no pod que expira orçamentos vencidos. Várias réplicas podem rodar ao mesmo
 * tempo: a versão otimista garante que cada orçamento expira uma vez só.
 */
@Injectable()
export class ExpiradorDeOrcamentos implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(ExpiradorDeOrcamentos.name);
  private timer?: NodeJS.Timeout;
  private cicloAtual: Promise<void> | null = null;

  constructor(
    private readonly expirar: ExpirarOrcamentosUseCase,
    @Inject(INJECTION_TOKENS.CONFIG_BILLING)
    private readonly config: ConfigBilling,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.intervaloExpiracaoMs <= 0) return;
    this.timer = setInterval(() => void this.executarCiclo(), this.config.intervaloExpiracaoMs);
  }

  /** Chamada durante um ciclo em andamento devolve a mesma promessa (sem sobreposição). */
  executarCiclo(): Promise<void> {
    this.cicloAtual ??= this.ciclo().finally(() => {
      this.cicloAtual = null;
    });
    return this.cicloAtual;
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.cicloAtual;
  }

  /**
   * O caso de uso segue o lote mesmo com falhas e relança o primeiro erro no fim
   * (cada falha já foi logada lá); aqui o erro só vira log para o timer continuar.
   */
  private async ciclo(): Promise<void> {
    try {
      const expirados = await this.expirar.execute();
      if (expirados > 0) this.logger.log({ msg: 'Orçamentos expirados', quantidade: expirados });
    } catch (erro) {
      this.logger.error({ msg: 'Falha ao expirar orçamentos', erro: erroParaLog(erro) });
    }
  }
}
