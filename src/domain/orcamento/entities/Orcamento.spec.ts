import { DomainError } from '../../shared/DomainError';
import { NovoOrcamento, Orcamento, StatusOrcamento, TipoItemOrcamento } from './Orcamento';

const AGORA = new Date('2026-10-20T10:00:00Z');
const VALIDO_ATE = new Date('2026-10-22T10:00:00Z');
const DEPOIS = new Date('2026-10-22T10:00:01Z');

const novo = (alteracoes: Partial<NovoOrcamento> = {}): NovoOrcamento => ({
  osId: '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d10',
  numeroOs: 42,
  cliente: { nome: 'Maria', email: 'maria@example.com' },
  itens: [
    {
      itemId: 'a1b2c3d4-0000-4000-8000-000000000001',
      tipo: TipoItemOrcamento.SERVICO,
      referenciaId: 'a1b2c3d4-0000-4000-8000-0000000000aa',
      descricao: 'Troca de óleo',
      quantidade: 2,
      valorUnitario: 45.1,
    },
    {
      itemId: 'a1b2c3d4-0000-4000-8000-000000000002',
      tipo: TipoItemOrcamento.INSUMO,
      referenciaId: 'a1b2c3d4-0000-4000-8000-0000000000bb',
      descricao: 'Arruela',
      quantidade: 3,
      valorUnitario: 0.1,
    },
  ],
  validoAte: VALIDO_ATE,
  tokenHash: 'hash',
  ...alteracoes,
});

const erro = (fn: () => unknown): DomainError => {
  try {
    fn();
  } catch (e) {
    return e as DomainError;
  }
  throw new Error('esperava erro');
};

describe('Orcamento', () => {
  it('nasce ENVIADO, versão 0 e soma o total em centavos', () => {
    const o = Orcamento.criar(novo());
    expect(o.status).toBe(StatusOrcamento.ENVIADO);
    expect(o.versao).toBe(0);
    expect(o.valorTotal).toBe(90.5);
    expect(o.decididoEm).toBeNull();
    expect(o.numeroOs).toBe(42);
  });

  it.each([
    [{ osId: ' ' }, 'ORCAMENTO_OS_OBRIGATORIA'],
    [{ numeroOs: 0 }, 'ORCAMENTO_NUMERO_INVALIDO'],
    [{ cliente: { nome: 'Maria', email: 'sem-arroba' } }, 'ORCAMENTO_EMAIL_INVALIDO'],
    [{ itens: [] }, 'ORCAMENTO_SEM_ITENS'],
  ])('rejeita dados inválidos %#', (alteracao, code) => {
    expect(erro(() => Orcamento.criar(novo(alteracao))).code).toBe(code);
  });

  it('rejeita orçamento sem valor a cobrar', () => {
    const [item] = novo().itens;
    const gratis = { ...item, valorUnitario: 0 };
    expect(erro(() => Orcamento.criar(novo({ itens: [gratis] }))).code).toBe(
      'ORCAMENTO_VALOR_ZERO',
    );
  });

  it('rejeita valor unitário com mais de 2 casas decimais', () => {
    const [item] = novo().itens;
    expect(
      erro(() => Orcamento.criar(novo({ itens: [{ ...item, valorUnitario: 1.005 }] }))).code,
    ).toBe('ORCAMENTO_VALOR_INVALIDO');
    expect(Orcamento.criar(novo({ itens: [{ ...item, valorUnitario: 45.1 }] })).valorTotal).toBe(
      90.2,
    );
    expect(Orcamento.criar(novo({ itens: [{ ...item, valorUnitario: 0.1 }] })).valorTotal).toBe(
      0.2,
    );
  });

  it('rejeita total acima do limite do Decimal(10,2)', () => {
    const [item] = novo().itens;
    const caro = { ...item, quantidade: 1, valorUnitario: 100_000_000 };
    expect(erro(() => Orcamento.criar(novo({ itens: [caro] }))).code).toBe(
      'ORCAMENTO_VALOR_EXCEDIDO',
    );
    const noLimite = { ...caro, valorUnitario: 99_999_999.99 };
    expect(Orcamento.criar(novo({ itens: [noLimite] })).valorTotal).toBe(99_999_999.99);
  });

  it('datas devolvidas não alteram o agregado', () => {
    const o = Orcamento.criar(novo());
    o.validoAte.setFullYear(1999);
    expect(o.validoAte.getTime()).toBe(VALIDO_ATE.getTime());
    o.aprovar(AGORA);
    o.decididoEm?.setFullYear(1999);
    expect(o.decididoEm?.getTime()).toBe(AGORA.getTime());
  });

  it('rejeita item repetido, quantidade e valor inválidos', () => {
    const [item] = novo().itens;
    expect(erro(() => Orcamento.criar(novo({ itens: [item, item] }))).code).toBe(
      'ORCAMENTO_ITEM_DUPLICADO',
    );
    expect(erro(() => Orcamento.criar(novo({ itens: [{ ...item, quantidade: 1.5 }] }))).code).toBe(
      'ORCAMENTO_QUANTIDADE_INVALIDA',
    );
    expect(
      erro(() => Orcamento.criar(novo({ itens: [{ ...item, valorUnitario: -1 }] }))).code,
    ).toBe('ORCAMENTO_VALOR_INVALIDO');
  });

  it('aprova dentro da validade e registra a data da decisão', () => {
    const o = Orcamento.criar(novo());
    o.aprovar(AGORA);
    expect(o.status).toBe(StatusOrcamento.APROVADO);
    expect(o.decididoEm).toEqual(AGORA);
  });

  it('reprova dentro da validade', () => {
    const o = Orcamento.criar(novo());
    o.reprovar(AGORA);
    expect(o.status).toBe(StatusOrcamento.REPROVADO);
  });

  it('não aceita segunda decisão nem decisão vencida', () => {
    const decidido = Orcamento.criar(novo());
    decidido.aprovar(AGORA);
    expect(erro(() => decidido.reprovar(AGORA)).code).toBe('ORCAMENTO_JA_DECIDIDO');
    expect(erro(() => Orcamento.criar(novo()).aprovar(DEPOIS)).code).toBe('ORCAMENTO_VENCIDO');
  });

  it('a mensagem de decisão recusada cita o status atual', () => {
    const o = Orcamento.criar(novo());
    o.cancelar();
    expect(erro(() => o.aprovar(AGORA)).message).toBe('Orçamento não aceita decisão: está CANCELADO');
  });

  it('expira só se ENVIADO e vencido', () => {
    const o = Orcamento.criar(novo());
    expect(erro(() => o.expirar(AGORA)).code).toBe('ORCAMENTO_NAO_EXPIRAVEL');
    o.expirar(DEPOIS);
    expect(o.status).toBe(StatusOrcamento.EXPIRADO);
    expect(o.vencido(DEPOIS)).toBe(true);
  });

  it('cancela a partir de ENVIADO ou APROVADO (compensação)', () => {
    const enviado = Orcamento.criar(novo());
    enviado.cancelar();
    expect(enviado.status).toBe(StatusOrcamento.CANCELADO);

    const aprovado = Orcamento.criar(novo());
    aprovado.aprovar(AGORA);
    expect(aprovado.podeSerCancelado()).toBe(true);
    aprovado.cancelar();
    expect(aprovado.status).toBe(StatusOrcamento.CANCELADO);

    const reprovado = Orcamento.criar(novo());
    reprovado.reprovar(AGORA);
    expect(reprovado.podeSerCancelado()).toBe(false);
    expect(erro(() => reprovado.cancelar()).code).toBe('ORCAMENTO_NAO_CANCELAVEL');
  });

  it('expõe cópias de cliente e itens e restaura o estado persistido', () => {
    const o = Orcamento.criar(novo());
    o.itens[0].quantidade = 99;
    o.cliente.nome = 'Outro';
    expect(o.itens[0].quantidade).toBe(2);
    expect(o.cliente.nome).toBe('Maria');

    const restaurado = Orcamento.restaurar(
      {
        ...novo(),
        valorTotal: 90.5,
        status: StatusOrcamento.APROVADO,
        decididoEm: AGORA,
        versao: 3,
      },
      o.id,
    );
    expect(restaurado.id.equals(o.id)).toBe(true);
    expect(restaurado.versao).toBe(3);
    expect(restaurado.tokenHash).toBe('hash');
    expect(restaurado.validoAte).toEqual(VALIDO_ATE);
  });
});
