import { StatusOrcamento, TipoItemOrcamento } from '../../../domain/orcamento/entities/Orcamento';
import { OrcamentoPublicoResponseDto } from '../dto/orcamento-publico-response.dto';

/**
 * Páginas HTML do link do e-mail (o cliente abre no navegador). Sem framework de front: HTML
 * gerado no servidor, sem JavaScript, e os botões são um formulário que faz POST na rota de
 * decisão. Um GET nunca decide nada: scanners de e-mail (Safe Links) abrem todos os links.
 */

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

const ENTIDADES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere]);
}

const SITUACAO: Record<StatusOrcamento, string> = {
  [StatusOrcamento.ENVIADO]: 'aguardando a sua decisão',
  [StatusOrcamento.APROVADO]: 'aprovado',
  [StatusOrcamento.REPROVADO]: 'reprovado',
  [StatusOrcamento.EXPIRADO]: 'expirado',
  [StatusOrcamento.CANCELADO]: 'cancelado',
};

const TIPO_ITEM: Record<TipoItemOrcamento, string> = {
  [TipoItemOrcamento.SERVICO]: 'Serviço',
  [TipoItemOrcamento.INSUMO]: 'Peça/insumo',
};

const ESTILO = `
  body { font-family: system-ui, sans-serif; background: #f4f5f7; color: #1f2328; margin: 0; padding: 16px; }
  main { max-width: 560px; margin: 24px auto; background: #fff; border-radius: 8px; padding: 24px;
         box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  h1 { font-size: 1.3rem; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #e5e7eb; }
  td.valor, th.valor { text-align: right; white-space: nowrap; }
  .total { font-size: 1.1rem; font-weight: 600; text-align: right; }
  .acoes { display: flex; gap: 12px; margin-top: 24px; }
  button { flex: 1; padding: 12px; font-size: 1rem; border: 0; border-radius: 6px; cursor: pointer; color: #fff; }
  .aprovar { background: #1a7f37; }
  .reprovar { background: #cf222e; }
  .aviso { color: #57606a; }
`;

function documento(titulo: string, corpo: string): string {
  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    `<title>${escapar(titulo)}</title>`,
    `<style>${ESTILO}</style>`,
    '</head>',
    `<body><main>${corpo}</main></body>`,
    '</html>',
  ].join('\n');
}

function tabelaDeItens(orcamento: OrcamentoPublicoResponseDto): string {
  const linhas = orcamento.itens.map(
    (item) =>
      `<tr><td>${escapar(item.descricao)}<br><small class="aviso">${TIPO_ITEM[item.tipo]}</small></td>` +
      `<td class="valor">${item.quantidade} x ${moeda.format(item.valorUnitario)}</td>` +
      `<td class="valor">${moeda.format(item.quantidade * item.valorUnitario)}</td></tr>`,
  );
  return [
    '<table>',
    '<thead><tr><th>Item</th><th class="valor">Qtd. x valor</th><th class="valor">Subtotal</th></tr></thead>',
    `<tbody>${linhas.join('')}</tbody>`,
    '</table>',
    `<p class="total">Total: ${moeda.format(orcamento.valorTotal)}</p>`,
  ].join('\n');
}

/** Formulário de decisão: action relativa ("42/decisao") funciona atrás de qualquer prefixo. */
function formularioDeDecisao(numeroOs: number, token: string): string {
  return [
    `<form method="post" action="${numeroOs}/decisao">`,
    `<input type="hidden" name="token" value="${escapar(token)}">`,
    '<div class="acoes">',
    '<button type="submit" name="decisao" value="APROVADA" class="aprovar">Aprovar</button>',
    '<button type="submit" name="decisao" value="REPROVADA" class="reprovar">Reprovar</button>',
    '</div>',
    '</form>',
  ].join('\n');
}

export function paginaDoOrcamento(orcamento: OrcamentoPublicoResponseDto, token: string): string {
  const pendente = orcamento.status === StatusOrcamento.ENVIADO;
  const rodape = pendente
    ? [
        `<p class="aviso">Válido até ${dataHora.format(orcamento.validoAte)}. A decisão é definitiva.</p>`,
        formularioDeDecisao(orcamento.numeroOs, token),
      ].join('\n')
    : `<p>Este orçamento está <strong>${SITUACAO[orcamento.status]}</strong>.</p>`;
  return documento(
    `Orçamento da OS #${orcamento.numeroOs}`,
    [
      `<h1>Orçamento da OS #${orcamento.numeroOs}</h1>`,
      `<p>Olá, ${escapar(orcamento.clienteNome)}.</p>`,
      tabelaDeItens(orcamento),
      rodape,
    ].join('\n'),
  );
}

export function paginaDaDecisao(orcamento: OrcamentoPublicoResponseDto): string {
  const aprovado = orcamento.status === StatusOrcamento.APROVADO;
  const titulo = aprovado ? 'Orçamento aprovado' : 'Orçamento reprovado';
  const mensagem = aprovado
    ? 'Obrigado! A oficina vai reservar as peças e iniciar o serviço. Você receberá o link de pagamento por e-mail quando o serviço for concluído.'
    : 'Tudo certo, nenhum serviço será feito e nenhuma cobrança será gerada.';
  return documento(
    `${titulo} — OS #${orcamento.numeroOs}`,
    [`<h1>${titulo} — OS #${orcamento.numeroOs}</h1>`, `<p>${mensagem}</p>`].join('\n'),
  );
}

export function paginaDeErro(mensagem: string): string {
  return documento(
    'Orçamento',
    ['<h1>Não foi possível concluir</h1>', `<p>${escapar(mensagem)}</p>`].join('\n'),
  );
}
