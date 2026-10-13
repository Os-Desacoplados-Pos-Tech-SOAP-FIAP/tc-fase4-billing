import { ConfigBilling } from '../../src/application/ports/config-billing';
import { GerarOrcamentoPayload } from '../../src/application/billing-messages';
import { TipoItemOrcamento } from '../../src/domain/orcamento/entities/Orcamento';
import { FakeTransactionManager } from './fake-transaction.manager';
import { GatewayDeTeste } from './gateway-de-teste';
import { InMemoryCobrancaRepository } from './in-memory-cobranca.repository';
import { InMemoryNotificador } from './in-memory-notificador';
import { InMemoryOrcamentoRepository } from './in-memory-orcamento.repository';
import { InMemoryOutbox } from './in-memory-outbox';
import { InMemoryPagamentoRepository } from './in-memory-pagamento.repository';
import { InMemoryProcessedMessageRepository } from './in-memory-processed-message.repository';
import { RelogioFixo } from './relogio-fixo';

export const OS = '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d10';

export function payloadOrcamento(numeroOs = 42): GerarOrcamentoPayload {
  return {
    numeroOs,
    cliente: { nome: 'Maria', email: 'maria@example.com' },
    itens: [
      {
        itemId: 'a1b2c3d4-0000-4000-8000-000000000001',
        tipo: TipoItemOrcamento.SERVICO,
        referenciaId: 'a1b2c3d4-0000-4000-8000-0000000000aa',
        descricao: 'Troca de óleo',
        quantidade: 1,
        valorUnitario: 120,
      },
      {
        itemId: 'a1b2c3d4-0000-4000-8000-000000000002',
        tipo: TipoItemOrcamento.INSUMO,
        referenciaId: 'a1b2c3d4-0000-4000-8000-0000000000bb',
        descricao: 'Filtro de óleo',
        quantidade: 1,
        valorUnitario: 45.5,
      },
    ],
  };
}

/** Todos os fakes ligados à mesma transação falsa. */
export function criarCenario() {
  const orcamentos = new InMemoryOrcamentoRepository();
  const cobrancas = new InMemoryCobrancaRepository();
  const pagamentos = new InMemoryPagamentoRepository();
  const processadas = new InMemoryProcessedMessageRepository();
  const outbox = new InMemoryOutbox();
  const transacao = new FakeTransactionManager().participar(
    orcamentos,
    cobrancas,
    pagamentos,
    processadas,
    outbox,
  );
  const config: ConfigBilling = {
    validadeOrcamentoHoras: 48,
    urlPublica: 'http://billing.test',
    intervaloExpiracaoMs: 0,
    pagamentoFake: true,
  };
  return {
    orcamentos,
    cobrancas,
    pagamentos,
    processadas,
    outbox,
    transacao,
    config,
    notificador: new InMemoryNotificador(),
    gateway: new GatewayDeTeste(),
    relogio: new RelogioFixo(),
  };
}

export type Cenario = ReturnType<typeof criarCenario>;
