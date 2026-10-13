/** Requisição já serializada pelo pino (pino-std-serializers). */
export interface RequisicaoSerializada {
  url?: string;
  query?: unknown;
  [campo: string]: unknown;
}

const ROTA_PUBLICA = '/publico/';

/**
 * Serializer de `req` do pino-http: nas rotas públicas o token de aprovação vai na query
 * string (`?token=`), então URL e query saem do log sem ela. Demais rotas ficam intactas.
 */
export function semQueryPublica<T extends RequisicaoSerializada>(req: T): T {
  if (!req.url?.includes(ROTA_PUBLICA)) return req;
  req.url = req.url.split('?')[0];
  req.query = {};
  return req;
}
