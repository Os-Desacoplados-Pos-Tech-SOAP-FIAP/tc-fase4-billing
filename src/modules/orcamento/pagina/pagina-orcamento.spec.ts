import { StatusOrcamento, TipoItemOrcamento } from '../../../domain/orcamento/entities/Orcamento';
import { OrcamentoPublicoResponseDto } from '../dto/orcamento-publico-response.dto';
import { paginaDeErro, paginaDoOrcamento, paginaDaDecisao } from './pagina-orcamento';

const orcamento = (status = StatusOrcamento.ENVIADO): OrcamentoPublicoResponseDto => ({
  numeroOs: 42,
  clienteNome: 'Ana <b>Souza</b>',
  itens: [
    { tipo: TipoItemOrcamento.SERVICO, descricao: 'Troca de óleo', quantidade: 1, valorUnitario: 120 },
    { tipo: TipoItemOrcamento.INSUMO, descricao: 'Filtro & junta', quantidade: 2, valorUnitario: 22.75 },
  ],
  valorTotal: 165.5,
  status,
  validoAte: new Date('2026-11-05T16:58:00Z'),
});

describe('página do orçamento', () => {
  it('mostra itens, total e validade, com o conteúdo escapado', () => {
    const html = paginaDoOrcamento(orcamento(), 'tok');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('OS #42');
    expect(html).toContain('Ana &lt;b&gt;Souza&lt;/b&gt;');
    expect(html).toContain('Filtro &amp; junta');
    expect(html).toMatch(/R\$\s165,50/);
    expect(html).toContain('05/11/2026');
    expect(html).not.toContain('<b>Souza</b>');
  });

  it('enquanto ENVIADO, traz o formulário com o token e os botões Aprovar e Reprovar', () => {
    const html = paginaDoOrcamento(orcamento(), 'a"b');
    expect(html).toContain('<form method="post" action="42/decisao">');
    expect(html).toContain('<input type="hidden" name="token" value="a&quot;b">');
    expect(html).toContain('<button type="submit" name="decisao" value="APROVADA"');
    expect(html).toContain('<button type="submit" name="decisao" value="REPROVADA"');
  });

  it('depois de decidido, não oferece botões e mostra a situação', () => {
    const html = paginaDoOrcamento(orcamento(StatusOrcamento.APROVADO), 'tok');
    expect(html).not.toContain('<form');
    expect(html).toContain('aprovado');
  });

  it('confirma a decisão registrada', () => {
    expect(paginaDaDecisao(orcamento(StatusOrcamento.APROVADO))).toContain('Orçamento aprovado');
    expect(paginaDaDecisao(orcamento(StatusOrcamento.REPROVADO))).toContain('Orçamento reprovado');
  });

  it('página de erro escapa a mensagem', () => {
    const html = paginaDeErro('Não <encontrado>');
    expect(html).toContain('Não &lt;encontrado&gt;');
  });
});
