import { NotFoundException } from '@nestjs/common';

import { SimularPagamentoUseCase } from '../../application/cobranca/simular-pagamento/SimularPagamentoUseCase';
import { ConfigBilling } from '../../application/ports/config-billing';
import { DevPagamentosController } from './dev-pagamentos.controller';

describe('DevPagamentosController', () => {
  it('com provedor real (PAYMENT_PROVIDER≠fake) responde 404 sem simular', async () => {
    const execute = jest.fn();
    const controller = new DevPagamentosController(
      { execute } as unknown as SimularPagamentoUseCase,
      { pagamentoFake: false } as ConfigBilling,
    );

    await expect(controller.simular('os-1', { aprovado: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
