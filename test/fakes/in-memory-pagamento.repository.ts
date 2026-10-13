import {
  IPagamentoRepository,
  RegistroPagamento,
} from '../../src/domain/cobranca/repositories/IPagamentoRepository';
import { ParticipanteTransacao } from './fake-transaction.manager';

export class InMemoryPagamentoRepository implements IPagamentoRepository, ParticipanteTransacao {
  public registros = new Map<string, RegistroPagamento>();

  async registrar(pagamento: RegistroPagamento): Promise<void> {
    this.registros.set(pagamento.mpPaymentId, { ...pagamento });
  }
  snapshot(): unknown {
    return new Map(this.registros);
  }
  restaurar(estado: unknown): void {
    this.registros = estado as Map<string, RegistroPagamento>;
  }
}
