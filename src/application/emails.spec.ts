import { UniqueID } from '../domain/shared/UniqueID';
import { Cobranca } from '../domain/cobranca/entities/Cobranca';
import { Orcamento, TipoItemOrcamento } from '../domain/orcamento/entities/Orcamento';
import {
  emailCobrancaGerada,
  emailOrcamentoCancelado,
  emailOrcamentoEnviado,
  emailPagamentoAprovado,
  emailPagamentoRecusado,
} from './emails';

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
    const email = emailOrcamentoEnviado(orcamento, 'http://x/link?token=abc', 'abc');
    expect(email.para).toBe('maria@example.com');
    expect(email.assunto).toContain('#42');
    expect(email.corpo).toContain('Troca de óleo');
    expect(email.corpo).toContain('R$');
    expect(email.corpo).toContain('22/10/2026');
    expect(email.corpo).toContain('07:00');
    expect(email.corpo).toContain('http://x/link?token=abc');
  });

  it('orçamento enviado traz o token numa linha própria, para copiar', () => {
    const email = emailOrcamentoEnviado(orcamento, 'http://x/link?token=abc', 'abc');
    expect(email.corpo).toContain('código de aprovação (uso único): abc');
  });

  it('orçamento enviado em HTML: link com texto, token visível e conteúdo escapado', () => {
    const comHtml = Orcamento.criar({
      osId: orcamento.osId,
      numeroOs: 42,
      cliente: { nome: 'Ana <script>', email: 'ana@example.com' },
      itens: [{ ...orcamento.itens[0], descricao: 'Óleo & filtro' }],
      validoAte: orcamento.validoAte,
      tokenHash: 'h',
    });
    const html = emailOrcamentoEnviado(comHtml, 'http://x/link?token=abc&b=1', 'abc').html;
    expect(html).toContain(
      '<a href="http://x/link?token=abc&amp;b=1">Ver orçamento</a>',
    );
    expect(html).toContain('<code>abc</code>');
    expect(html).toContain('Ana &lt;script&gt;');
    expect(html).toContain('Óleo &amp; filtro');
    expect(html).not.toContain('<script>');
  });

  it('orçamento cancelado explica o motivo quando houver', () => {
    expect(emailOrcamentoCancelado(orcamento, 'cliente desistiu').corpo).toContain(
      'cliente desistiu',
    );
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
    expect(email.html).toContain('<a href="https://mp.test/checkout/1">Pagar agora</a>');
  });

  it('pagamento aprovado traz OS, valor pago e libera a retirada do veículo', () => {
    const email = emailPagamentoAprovado(orcamento, 165.5);
    expect(email.para).toBe('maria@example.com');
    expect(email.assunto).toContain('#42');
    expect(email.assunto).toContain('confirmado');
    expect(email.corpo).toContain('Maria');
    expect(email.corpo).toMatch(/R\$\s165,50/);
    expect(email.corpo).toContain('retirado');
  });

  it('pagamento recusado avisa que um novo link será enviado', () => {
    const email = emailPagamentoRecusado(orcamento);
    expect(email.para).toBe('maria@example.com');
    expect(email.assunto).toContain('#42');
    expect(email.assunto).toContain('recusado');
    expect(email.corpo).toContain('recusado');
    expect(email.corpo).toContain('novo link de pagamento');
  });
});
