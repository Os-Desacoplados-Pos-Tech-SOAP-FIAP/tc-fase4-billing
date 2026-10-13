import { UniqueID } from '../domain/shared/UniqueID';
import { Cobranca } from '../domain/cobranca/entities/Cobranca';
import { Orcamento, TipoItemOrcamento } from '../domain/orcamento/entities/Orcamento';
import { emailCobrancaGerada, emailOrcamentoCancelado, emailOrcamentoEnviado } from './emails';

const orcamento = Orcamento.criar({
  osId: '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d10',
  numeroOs: 42,
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
  ],
  validoAte: new Date('2026-10-22T10:00:00Z'),
  tokenHash: 'h',
});

describe('e-mails ao cliente', () => {
  it('orçamento enviado traz itens, total, validade e o link', () => {
    const email = emailOrcamentoEnviado(orcamento, 'http://x/link?token=abc');
    expect(email.para).toBe('maria@example.com');
    expect(email.assunto).toContain('#42');
    expect(email.corpo).toContain('Troca de óleo');
    expect(email.corpo).toContain('R$');
    expect(email.corpo).toContain('2026-10-22T10:00:00.000Z');
    expect(email.corpo).toContain('http://x/link?token=abc');
  });

  it('orçamento cancelado explica o motivo quando houver', () => {
    expect(emailOrcamentoCancelado(orcamento, 'sem estoque').corpo).toContain('sem estoque');
    expect(emailOrcamentoCancelado(orcamento).corpo).toContain('cancelado');
  });

  it('cobrança gerada traz valor e link de pagamento', () => {
    const cobranca = Cobranca.criar(
      {
        osId: orcamento.osId,
        orcamentoId: orcamento.id.toValue(),
        valor: 120,
        preferenceId: 'p',
        initPoint: 'https://mp.test/checkout/1',
      },
      new UniqueID(),
    );
    const email = emailCobrancaGerada(orcamento, cobranca);
    expect(email.assunto).toContain('#42');
    expect(email.corpo).toContain('https://mp.test/checkout/1');
  });
});
