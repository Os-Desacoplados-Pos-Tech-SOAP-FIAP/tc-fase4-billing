import { Prisma } from '@prisma/client';

import { ConcorrenciaError } from '../../src/application/errors';
import { Cobranca, StatusCobranca } from '../../src/domain/cobranca/entities/Cobranca';
import { Orcamento, StatusOrcamento } from '../../src/domain/orcamento/entities/Orcamento';
import { UniqueID } from '../../src/domain/shared/UniqueID';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { PrismaTransactionManager } from '../../src/infrastructure/database/prisma-transaction.manager';
import { PrismaCobrancaRepository } from '../../src/infrastructure/repositories/PrismaCobrancaRepository';
import { PrismaOrcamentoRepository } from '../../src/infrastructure/repositories/PrismaOrcamentoRepository';
import { PrismaPagamentoRepository } from '../../src/infrastructure/repositories/PrismaPagamentoRepository';
import { OS, payloadOrcamento } from '../fakes/cenario';
import { conectar, limparBanco } from '../helpers/database';

const OS_2 = '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d02';
const OS_3 = '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d03';
const DECISAO = new Date('2026-10-20T10:00:00Z');

/** Violação de unicidade do Postgres traduzida pelo Prisma. */
const violacaoDeUnicidade = expect.objectContaining({ code: 'P2002' });

describe('Repositórios Prisma (integração)', () => {
  let prisma: PrismaService;
  let orcamentos: PrismaOrcamentoRepository;
  let cobrancas: PrismaCobrancaRepository;
  let pagamentos: PrismaPagamentoRepository;

  beforeAll(async () => {
    prisma = await conectar();
    const db = new PrismaTransactionManager(prisma);
    orcamentos = new PrismaOrcamentoRepository(db);
    cobrancas = new PrismaCobrancaRepository(db);
    pagamentos = new PrismaPagamentoRepository(db);
  });
  beforeEach(() => limparBanco(prisma));
  afterAll(() => prisma.$disconnect());

  const novoOrcamento = (osId = OS, numeroOs = 42, validoAte = '2026-10-22T10:00:00Z') =>
    Orcamento.criar({ osId, ...payloadOrcamento(numeroOs), validoAte: new Date(validoAte), tokenHash: 'h' });

  const novaCobranca = (osId = OS) =>
    Cobranca.criar(
      { osId, orcamentoId: OS, valor: 165.5, preferenceId: 'p', initPoint: 'https://mp.test/1' },
      new UniqueID(),
    );

  describe('PrismaOrcamentoRepository', () => {
    it('grava e lê por OS e por número, preservando cliente, itens e total', async () => {
      const o = novoOrcamento();
      await orcamentos.salvar(o);

      const lido = (await orcamentos.buscarPorOs(OS))!;
      expect(lido.id.equals(o.id)).toBe(true);
      expect(lido.versao).toBe(1);
      expect(lido.valorTotal).toBe(165.5);
      expect(lido.itens).toEqual(o.itens);
      expect(lido.cliente).toEqual({ nome: 'Maria', email: 'maria@example.com' });
      expect(lido.status).toBe(StatusOrcamento.ENVIADO);
      expect((await orcamentos.buscarPorNumeroOs(42))!.osId).toBe(OS);
      expect(await orcamentos.buscarPorOs(OS_2)).toBeNull();
    });

    it('atualiza com a versão lida e rejeita versão desatualizada', async () => {
      await orcamentos.salvar(novoOrcamento());
      const a = (await orcamentos.buscarPorOs(OS))!;
      const b = (await orcamentos.buscarPorOs(OS))!;
      a.aprovar(DECISAO);
      await orcamentos.salvar(a);
      b.reprovar(DECISAO);

      await expect(orcamentos.salvar(b)).rejects.toBeInstanceOf(ConcorrenciaError);
      const lido = (await orcamentos.buscarPorOs(OS))!;
      expect(lido.status).toBe(StatusOrcamento.APROVADO);
      expect(lido.versao).toBe(2);
      expect(lido.decididoEm).toEqual(DECISAO);
    });

    it('não permite dois orçamentos para a mesma OS', async () => {
      await orcamentos.salvar(novoOrcamento(OS, 1));
      await expect(orcamentos.salvar(novoOrcamento(OS, 2))).rejects.toEqual(violacaoDeUnicidade);
    });

    it('não permite dois orçamentos com o mesmo número de OS', async () => {
      await orcamentos.salvar(novoOrcamento(OS, 1));
      await expect(orcamentos.salvar(novoOrcamento(OS_2, 1))).rejects.toEqual(violacaoDeUnicidade);
    });

    it('lista só ENVIADOS vencidos, mais antigos primeiro, respeitando o limite', async () => {
      await orcamentos.salvar(novoOrcamento(OS, 1, '2026-10-20T09:00:00Z'));
      await orcamentos.salvar(novoOrcamento(OS_2, 2, '2026-10-20T08:00:00Z'));
      await orcamentos.salvar(novoOrcamento(OS_3, 3, '2026-10-21T08:00:00Z'));
      const decidido = (await orcamentos.buscarPorOs(OS))!;
      decidido.reprovar(new Date('2026-10-20T08:30:00Z'));
      await orcamentos.salvar(decidido);

      const agora = new Date('2026-10-20T10:00:00Z');
      expect((await orcamentos.listarVencidos(agora, 10)).map((o) => o.numeroOs)).toEqual([2]);
      await orcamentos.salvar(novoOrcamento('7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d04', 4, '2026-10-20T07:00:00Z'));
      expect((await orcamentos.listarVencidos(agora, 1)).map((o) => o.numeroOs)).toEqual([4]);
    });
  });

  describe('PrismaCobrancaRepository', () => {
    it('grava, lê e atualiza o status', async () => {
      const c = novaCobranca();
      await cobrancas.salvar(c);

      const lida = (await cobrancas.buscarPendentePorOs(OS))!;
      expect(lida.valor).toBe(165.5);
      expect(lida.versao).toBe(1);
      lida.confirmar('mp-1');
      await cobrancas.salvar(lida);

      expect(await cobrancas.buscarPendentePorOs(OS)).toBeNull();
      expect((await cobrancas.buscarPagaPorOs(OS))!.mpPaymentId).toBe('mp-1');
      expect((await cobrancas.buscarPorId(c.id.toValue()))!.status).toBe(StatusCobranca.PAGA);
      expect(await cobrancas.buscarPorId('nao-existe')).toBeNull();
    });

    it('não permite duas cobranças PENDENTES para a mesma OS', async () => {
      await cobrancas.salvar(novaCobranca());
      const duplicada = cobrancas.salvar(novaCobranca());
      await expect(duplicada).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      await expect(duplicada).rejects.toEqual(violacaoDeUnicidade);
      await expect(cobrancas.salvar(novaCobranca(OS_2))).resolves.toBeUndefined();
    });

    it('depois de recusada aceita nova pendente e lista as duas', async () => {
      const primeira = novaCobranca();
      await cobrancas.salvar(primeira);
      const lida = (await cobrancas.buscarPorId(primeira.id.toValue()))!;
      lida.recusar('mp-1');
      await cobrancas.salvar(lida);
      await cobrancas.salvar(novaCobranca());

      const statuses = (await cobrancas.listarPorOs(OS)).map((c) => c.status).sort();
      expect(statuses).toEqual([StatusCobranca.PENDENTE, StatusCobranca.RECUSADA]);
    });

    it('rejeita versão desatualizada', async () => {
      const c = novaCobranca();
      await cobrancas.salvar(c);
      const a = (await cobrancas.buscarPorId(c.id.toValue()))!;
      const b = (await cobrancas.buscarPorId(c.id.toValue()))!;
      a.confirmar('mp-1');
      await cobrancas.salvar(a);
      b.recusar('mp-2');
      await expect(cobrancas.salvar(b)).rejects.toBeInstanceOf(ConcorrenciaError);
    });
  });

  describe('PrismaPagamentoRepository', () => {
    it('registra e atualiza pelo id do Mercado Pago', async () => {
      const registro = {
        mpPaymentId: 'mp-1',
        cobrancaId: 'c-1',
        status: 'in_process',
        valor: 10,
        payloadBruto: { id: 'mp-1' },
      };
      await pagamentos.registrar(registro);
      await pagamentos.registrar({ ...registro, status: 'approved' });

      const linhas = await prisma.pagamento.findMany();
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ status: 'approved', payloadBruto: { id: 'mp-1' } });
    });
  });
});
