import { createHmac, timingSafeEqual } from 'node:crypto';

export interface DadosAssinatura {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  segredo: string;
}

const ALFANUMERICO = /^[a-z0-9]+$/i;

function lerCabecalho(xSignature: string): Record<string, string> {
  const partes: Record<string, string> = {};
  for (const parte of xSignature.split(',')) {
    const [chave, valor] = parte.split('=');
    if (chave && valor) partes[chave.trim()] = valor.trim();
  }
  return partes;
}

/**
 * Valida o header x-signature do webhook do Mercado Pago (HMAC-SHA256 do manifesto
 * id/request-id/ts com a assinatura secreta). Comparação em tempo constante.
 */
export function assinaturaMercadoPagoValida(dados: DadosAssinatura): boolean {
  if (!dados.segredo || !dados.xSignature) return false;
  const { ts, v1 } = lerCabecalho(dados.xSignature);
  if (!ts || !v1) return false;

  const id = dados.dataId && ALFANUMERICO.test(dados.dataId) ? dados.dataId.toLowerCase() : dados.dataId;
  let manifesto = '';
  if (id) manifesto += `id:${id};`;
  if (dados.xRequestId) manifesto += `request-id:${dados.xRequestId};`;
  manifesto += `ts:${ts};`;

  const esperado = Buffer.from(createHmac('sha256', dados.segredo).update(manifesto).digest('hex'), 'hex');
  const recebido = Buffer.from(v1, 'hex');
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
