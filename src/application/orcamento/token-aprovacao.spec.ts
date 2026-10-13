import { gerarTokenAprovacao, hashToken, tokenConfere } from './token-aprovacao';

describe('token de aprovação', () => {
  it('gera token aleatório e guarda só o hash', () => {
    const a = gerarTokenAprovacao();
    const b = gerarTokenAprovacao();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('confere o token contra o hash', () => {
    const { token, hash } = gerarTokenAprovacao();
    expect(tokenConfere(token, hash)).toBe(true);
    expect(tokenConfere(`${token}x`, hash)).toBe(false);
    expect(tokenConfere(token, 'nao-hex')).toBe(false);
  });
});
