import { Cobranca } from '../domain/cobranca/entities/Cobranca';
import { Orcamento } from '../domain/orcamento/entities/Orcamento';
import { Email } from './ports/notificador';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function emailOrcamentoEnviado(orcamento: Orcamento, link: string): Email {
  const itens = orcamento.itens.map(
    (item) => `- ${item.descricao} (${item.quantidade} x ${moeda.format(item.valorUnitario)})`,
  );
  return {
    para: orcamento.cliente.email,
    assunto: `Orçamento da OS #${orcamento.numeroOs} disponível para aprovação`,
    corpo: [
      `Olá ${orcamento.cliente.nome},`,
      '',
      'Seu orçamento está pronto:',
      ...itens,
      '',
      `Total: ${moeda.format(orcamento.valorTotal)}`,
      `Válido até: ${orcamento.validoAte.toISOString()}`,
      '',
      `Aprove ou reprove pelo link (uso único): ${link}`,
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
  return {
    para: orcamento.cliente.email,
    assunto: `Pagamento da OS #${orcamento.numeroOs}`,
    corpo: [
      `Olá ${orcamento.cliente.nome},`,
      '',
      `O serviço foi concluído. Valor: ${moeda.format(cobranca.valor)}`,
      `Pague pelo link: ${cobranca.initPoint}`,
    ].join('\n'),
  };
}
