import { Cobranca } from '../domain/cobranca/entities/Cobranca';
import { Orcamento } from '../domain/orcamento/entities/Orcamento';
import { Email } from './ports/notificador';

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

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere]);
}

/** Linhas de texto viram parágrafos HTML escapados (linhas vazias são descartadas). */
function paragrafos(linhas: string[]): string[] {
  return linhas.filter(Boolean).map((linha) => `<p>${escaparHtml(linha)}</p>`);
}

/**
 * Link com texto curto: filtros como o Safe Links do Outlook reescrevem a URL do e-mail de
 * texto e a deixam ilegível; no HTML o cliente vê só o texto.
 */
function linkHtml(url: string, texto: string): string {
  return `<a href="${escaparHtml(url)}">${escaparHtml(texto)}</a>`;
}

export function emailOrcamentoEnviado(orcamento: Orcamento, link: string, token: string): Email {
  const itens = orcamento.itens.map(
    (item) => `- ${item.descricao} (${item.quantidade} x ${moeda.format(item.valorUnitario)})`,
  );
  const resumo = [
    `Olá ${orcamento.cliente.nome},`,
    '',
    'Seu orçamento está pronto:',
    ...itens,
    '',
    `Total: ${moeda.format(orcamento.valorTotal)}`,
    `Válido até: ${dataHora.format(orcamento.validoAte)}`,
  ];
  const codigo = 'Para aprovar ou reprovar, use o código de aprovação (uso único):';
  return {
    para: orcamento.cliente.email,
    assunto: `Orçamento da OS #${orcamento.numeroOs} disponível para aprovação`,
    corpo: [
      ...resumo,
      '',
      `Veja o orçamento pelo link: ${link}`,
      `${codigo} ${token}`,
    ].join('\n'),
    html: [
      ...paragrafos(resumo),
      `<p>${linkHtml(link, 'Ver orçamento')}</p>`,
      `<p>${codigo} <code>${escaparHtml(token)}</code></p>`,
    ].join('\n'),
  };
}

export function emailOrcamentoCancelado(orcamento: Orcamento, motivo?: string): Email {
  return {
    para: orcamento.cliente.email,
    assunto: `Orçamento da OS #${orcamento.numeroOs} cancelado`,
    corpo: [
      `Olá ${orcamento.cliente.nome},`,
      '',
      'Seu orçamento foi cancelado e nenhuma cobrança será feita.',
      motivo ? `Motivo: ${motivo}` : '',
    ].join('\n'),
  };
}

export function emailCobrancaGerada(orcamento: Orcamento, cobranca: Cobranca): Email {
  const resumo = [
    `Olá ${orcamento.cliente.nome},`,
    '',
    `O serviço foi concluído. Valor: ${moeda.format(cobranca.valor)}`,
  ];
  return {
    para: orcamento.cliente.email,
    assunto: `Pagamento da OS #${orcamento.numeroOs}`,
    corpo: [...resumo, `Pague pelo link: ${cobranca.initPoint}`].join('\n'),
    html: [...paragrafos(resumo), `<p>${linkHtml(cobranca.initPoint, 'Pagar agora')}</p>`].join(
      '\n',
    ),
  };
}

export function emailPagamentoAprovado(orcamento: Orcamento, valorPago: number): Email {
  return {
    para: orcamento.cliente.email,
    assunto: `Pagamento da OS #${orcamento.numeroOs} confirmado`,
    corpo: [
      `Olá ${orcamento.cliente.nome},`,
      '',
      `Recebemos o pagamento de ${moeda.format(valorPago)} da OS #${orcamento.numeroOs}.`,
      'Seu veículo já pode ser retirado.',
    ].join('\n'),
  };
}

export function emailPagamentoRecusado(orcamento: Orcamento): Email {
  return {
    para: orcamento.cliente.email,
    assunto: `Pagamento da OS #${orcamento.numeroOs} recusado`,
    corpo: [
      `Olá ${orcamento.cliente.nome},`,
      '',
      `O pagamento da OS #${orcamento.numeroOs} foi recusado.`,
      'Em breve você receberá um novo link de pagamento por e-mail.',
    ].join('\n'),
  };
}
