import { DomainError } from '../../shared/DomainError';
import { UniqueID } from '../../shared/UniqueID';
import { Cobranca, NovaCobranca, StatusCobranca } from './Cobranca';

const nova: NovaCobranca = {
  osId: '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d10',
  orcamentoId: '7f2b2a8e-1d7c-4a35-9c1e-0a4f3b2c1d11',
  valor: 150.5,
  preferenceId: 'pref-1',
  initPoint: 'https://mp.test/checkout/1',
};

const codigo = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  throw new Error('esperava erro');
};

describe('Cobranca', () => {
  it('nasce PENDENTE com o id informado (vai como external_reference)', () => {
    const id = new UniqueID();
    const c = Cobranca.criar(nova, id);
    expect(c.id.equals(id)).toBe(true);
    expect(c.status).toBe(StatusCobranca.PENDENTE);
    expect(c.mpPaymentId).toBeNull();
    expect(c.versao).toBe(0);
    expect(c.valor).toBe(150.5);
  });

  it('exige valor positivo', () => {
    expect(codigo(() => Cobranca.criar({ ...nova, valor: 0 }, new UniqueID()))).toBe(
      'COBRANCA_VALOR_INVALIDO',
    );
  });

  it('confirma pendente e guarda o pagamento', () => {
    const c = Cobranca.criar(nova, new UniqueID());
    c.confirmar('mp-1');
    expect(c.status).toBe(StatusCobranca.PAGA);
    expect(c.mpPaymentId).toBe('mp-1');
    expect(codigo(() => c.confirmar('mp-2'))).toBe('COBRANCA_JA_PAGA');
  });

  it('recusa só pendente', () => {
    const c = Cobranca.criar(nova, new UniqueID());
    c.recusar('mp-1');
    expect(c.status).toBe(StatusCobranca.RECUSADA);
    expect(codigo(() => c.recusar('mp-2'))).toBe('COBRANCA_NAO_PENDENTE');
  });

  it('pagamento aprovado depois de uma recusa no mesmo link confirma (o dinheiro entrou)', () => {
    const c = Cobranca.criar(nova, new UniqueID());
    c.recusar('mp-1');
    c.confirmar('mp-2');
    expect(c.status).toBe(StatusCobranca.PAGA);
    expect(c.mpPaymentId).toBe('mp-2');
  });

  it('restaura o estado persistido', () => {
    const id = new UniqueID();
    const c = Cobranca.restaurar(
      { ...nova, status: StatusCobranca.PAGA, mpPaymentId: 'mp-9', versao: 2 },
      id,
    );
    expect(c.status).toBe(StatusCobranca.PAGA);
    expect(c.versao).toBe(2);
    expect(c.osId).toBe(nova.osId);
    expect(c.orcamentoId).toBe(nova.orcamentoId);
    expect(c.preferenceId).toBe('pref-1');
    expect(c.initPoint).toBe('https://mp.test/checkout/1');
  });
});
