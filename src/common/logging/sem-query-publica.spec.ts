import { semQueryPublica } from './sem-query-publica';

describe('semQueryPublica', () => {
  it('tira a query string (token) das rotas públicas', () => {
    const req = {
      method: 'GET',
      url: '/api/billing/publico/orcamentos/42?token=segredo',
      query: { token: 'segredo' },
    };

    const serializado = semQueryPublica(req);

    expect(serializado).toBe(req);
    expect(serializado).toEqual({ method: 'GET', url: '/api/billing/publico/orcamentos/42', query: {} });
    expect(JSON.stringify(serializado)).not.toContain('segredo');
  });

  it('mantém intactas as demais rotas', () => {
    const req = { url: '/api/billing/orcamentos/os-1?pagina=2', query: { pagina: '2' } };

    expect(semQueryPublica({ ...req })).toEqual(req);
  });

  it('aceita requisição sem url', () => {
    expect(semQueryPublica({ method: 'GET' })).toEqual({ method: 'GET' });
  });
});
