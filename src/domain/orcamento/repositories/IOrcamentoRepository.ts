import { Orcamento } from '../entities/Orcamento';

export interface IOrcamentoRepository {
  /** Insere (versão 0) ou atualiza conferindo a versão; conflito lança ConcorrenciaError. */
  salvar(orcamento: Orcamento): Promise<void>;
  buscarPorOs(osId: string): Promise<Orcamento | null>;
  buscarPorNumeroOs(numeroOs: number): Promise<Orcamento | null>;
  /** ENVIADOS com validade vencida, os mais antigos primeiro. */
  listarVencidos(agora: Date, limite: number): Promise<Orcamento[]>;
}
