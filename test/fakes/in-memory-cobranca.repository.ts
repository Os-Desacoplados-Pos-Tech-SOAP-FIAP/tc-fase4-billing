import { ConcorrenciaError } from '../../src/application/errors';
import { Cobranca, StatusCobranca } from '../../src/domain/cobranca/entities/Cobranca';
import { ICobrancaRepository } from '../../src/domain/cobranca/repositories/ICobrancaRepository';
import { ParticipanteTransacao } from './fake-transaction.manager';

export class InMemoryCobrancaRepository implements ICobrancaRepository, ParticipanteTransacao {
  private porId = new Map<string, Cobranca>();

  async salvar(cobranca: Cobranca): Promise<void> {
    const id = cobranca.id.toValue();
    const atual = this.porId.get(id);
    if (cobranca.versao === 0 ? atual : atual?.versao !== cobranca.versao) {
      throw new ConcorrenciaError('Cobrança');
    }
    const outraPendente = [...this.porId.values()].some(
      (c) =>
        c.osId === cobranca.osId &&
        c.status === StatusCobranca.PENDENTE &&
        c.id.toValue() !== id,
    );
    if (cobranca.status === StatusCobranca.PENDENTE && outraPendente) {
      throw new Error('violação do índice de cobrança pendente única por OS');
    }
    this.porId.set(id, copiar(cobranca, cobranca.versao + 1));
  }

  async buscarPorId(id: string): Promise<Cobranca | null> {
    const c = this.porId.get(id);
    return c ? copiar(c, c.versao) : null;
  }

  async buscarPendentePorOs(osId: string): Promise<Cobranca | null> {
    return this.primeira(osId, StatusCobranca.PENDENTE);
  }

  async buscarPagaPorOs(osId: string): Promise<Cobranca | null> {
    return this.primeira(osId, StatusCobranca.PAGA);
  }

  async listarPorOs(osId: string): Promise<Cobranca[]> {
    return [...this.porId.values()].filter((c) => c.osId === osId).map((c) => copiar(c, c.versao));
  }

  private primeira(osId: string, status: StatusCobranca): Cobranca | null {
    const c = [...this.porId.values()].find((x) => x.osId === osId && x.status === status);
    return c ? copiar(c, c.versao) : null;
  }

  snapshot(): unknown {
    return new Map(this.porId);
  }
  restaurar(estado: unknown): void {
    this.porId = estado as Map<string, Cobranca>;
  }
}

function copiar(c: Cobranca, versao: number): Cobranca {
  return Cobranca.restaurar(
    {
      osId: c.osId,
      orcamentoId: c.orcamentoId,
      valor: c.valor,
      preferenceId: c.preferenceId,
      initPoint: c.initPoint,
      status: c.status,
      mpPaymentId: c.mpPaymentId,
      versao,
      criadoEm: c.criadoEm,
      atualizadoEm: c.atualizadoEm,
    },
    c.id,
  );
}
