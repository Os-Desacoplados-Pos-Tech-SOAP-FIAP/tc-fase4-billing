import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits aleatórios; só o hash vai para o banco. */
export function gerarTokenAprovacao(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação em tempo constante. */
export function tokenConfere(token: string, hash: string): boolean {
  const esperado = Buffer.from(hashToken(token), 'hex');
  const guardado = Buffer.from(hash, 'hex');
  return esperado.length === guardado.length && timingSafeEqual(esperado, guardado);
}

/** Link enviado no e-mail; aponta para a rota pública do Billing (via API Gateway na AWS). */
export function linkDeAprovacao(urlPublica: string, numeroOs: number, token: string): string {
  return `${urlPublica}/api/billing/publico/orcamentos/${numeroOs}?token=${token}`;
}
