import { ConcorrenciaError } from '../../src/application/errors';
import { Orcamento, StatusOrcamento } from '../../src/domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../src/domain/orcamento/repositories/IOrcamentoRepository';
import { ParticipanteTransacao } from './fake-transaction.manager';

/** Guarda cópias com a versão incrementada, como o banco faria. */
export class InMemoryOrcamentoRepository implements IOrcamentoRepository, ParticipanteTransacao {
  private porOs = new Map<string, Orcamento>();

  async salvar(orcamento: Orcamento): Promise<void> {
    const atual = this.porOs.get(orcamento.osId);
    if (orcamento.versao === 0) {
      const numeroRepetido = [...this.porOs.values()].some(
        (o) => o.numeroOs === orcamento.numeroOs,
      );
      if (atual || numeroRepetido) throw new Error('violação de unicidade em Orcamento');
    } else if (atual?.versao !== orcamento.versao) {
      throw new ConcorrenciaError('Orçamento');
    }
    this.porOs.set(orcamento.osId, copiar(orcamento, orcamento.versao + 1));
  }

  async buscarPorOs(osId: string): Promise<Orcamento | null> {
    const o = this.porOs.get(osId);
    return o ? copiar(o, o.versao) : null;
  }

  async buscarPorNumeroOs(numeroOs: number): Promise<Orcamento | null> {
    const o = [...this.porOs.values()].find((x) => x.numeroOs === numeroOs);
    return o ? copiar(o, o.versao) : null;
  }

  async listarVencidos(agora: Date, limite: number): Promise<Orcamento[]> {
    return [...this.porOs.values()]
      .filter((o) => o.status === StatusOrcamento.ENVIADO && o.vencido(agora))
      .sort((a, b) => a.validoAte.getTime() - b.validoAte.getTime())
      .slice(0, limite)
      .map((o) => copiar(o, o.versao));
  }

  snapshot(): unknown {
    return new Map(this.porOs);
  }
  restaurar(estado: unknown): void {
    this.porOs = estado as Map<string, Orcamento>;
  }
}

function copiar(o: Orcamento, versao: number): Orcamento {
  return Orcamento.restaurar(
    {
      osId: o.osId,
      numeroOs: o.numeroOs,
      cliente: o.cliente,
      itens: o.itens,
      valorTotal: o.valorTotal,
      status: o.status,
      validoAte: o.validoAte,
      tokenHash: o.tokenHash,
      decididoEm: o.decididoEm,
      versao,
      criadoEm: o.criadoEm,
      atualizadoEm: o.atualizadoEm,
    },
    o.id,
  );
}
