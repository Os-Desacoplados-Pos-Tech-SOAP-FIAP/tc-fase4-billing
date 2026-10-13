import { Cobranca } from '../entities/Cobranca';

export interface ICobrancaRepository {
  /** Insere (versão 0) ou atualiza conferindo a versão; conflito lança ConcorrenciaError. */
  salvar(cobranca: Cobranca): Promise<void>;
  buscarPorId(id: string): Promise<Cobranca | null>;
  buscarPendentePorOs(osId: string): Promise<Cobranca | null>;
  buscarPagaPorOs(osId: string): Promise<Cobranca | null>;
  listarPorOs(osId: string): Promise<Cobranca[]>;
}
