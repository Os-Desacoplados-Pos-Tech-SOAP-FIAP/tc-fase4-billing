import { createHmac } from 'node:crypto';

import { assinaturaMercadoPagoValida } from './assinatura-mercado-pago';

const SEGREDO = 'segredo';
const hmac = (manifesto: string, segredo = SEGREDO) =>
  createHmac('sha256', segredo).update(manifesto).digest('hex');

describe('assinaturaMercadoPagoValida', () => {
  const base = { xRequestId: 'req-1', dataId: '123', segredo: SEGREDO };

  it('aceita a assinatura correta', () => {
    const v1 = hmac('id:123;request-id:req-1;ts:1700;');
    expect(assinaturaMercadoPagoValida({ ...base, xSignature: `ts=1700,v1=${v1}` })).toBe(true);
  });

  it('normaliza data.id alfanumérico para minúsculas', () => {
    const v1 = hmac('id:abc123;request-id:req-1;ts:1700;');
    expect(
      assinaturaMercadoPagoValida({ ...base, dataId: 'ABC123', xSignature: `ts=1700, v1=${v1}` }),
    ).toBe(true);
  });

  it('omite do manifesto as partes ausentes', () => {
    const v1 = hmac('id:123;ts:1700;');
    expect(
      assinaturaMercadoPagoValida({ ...base, xRequestId: undefined, xSignature: `ts=1700,v1=${v1}` }),
    ).toBe(true);
  });

  it.each([
    ['segredo errado', { xSignature: `ts=1700,v1=${hmac('id:123;request-id:req-1;ts:1700;', 'outro')}` }],
    ['ts adulterado', { xSignature: `ts=1701,v1=${hmac('id:123;request-id:req-1;ts:1700;')}` }],
    ['sem header', { xSignature: undefined }],
    ['sem v1', { xSignature: 'ts=1700' }],
    ['v1 não hexadecimal', { xSignature: 'ts=1700,v1=zz' }],
    ['sem segredo configurado', { xSignature: 'ts=1700,v1=00', segredo: '' }],
  ])('recusa: %s', (_caso, alteracao) => {
    expect(assinaturaMercadoPagoValida({ ...base, ...alteracao })).toBe(false);
  });
});
