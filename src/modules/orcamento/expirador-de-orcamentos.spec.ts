import { Logger } from '@nestjs/common';

import { ExpirarOrcamentosUseCase } from '../../application/orcamento/expirar-orcamentos/ExpirarOrcamentosUseCase';
import { ConfigBilling } from '../../application/ports/config-billing';
import { ExpiradorDeOrcamentos } from './expirador-de-orcamentos';

const config = (intervaloExpiracaoMs: number): ConfigBilling => ({
  validadeOrcamentoHoras: 48,
  urlPublica: 'http://x',
  intervaloExpiracaoMs,
  pagamentoFake: true,
});

const criar = (execute: jest.Mock, intervalo = 1000) =>
  new ExpiradorDeOrcamentos({ execute } as unknown as ExpirarOrcamentosUseCase, config(intervalo));

describe('ExpiradorDeOrcamentos', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('intervalo 0 não agenda nada', () => {
    const agendar = jest.spyOn(global, 'setInterval');
    criar(jest.fn(), 0).onApplicationBootstrap();
    expect(agendar).not.toHaveBeenCalled();
  });

  it('roda a cada intervalo e para no desligamento', async () => {
    jest.useFakeTimers();
    const execute = jest.fn().mockResolvedValue(0);
    const expirador = criar(execute);
    expirador.onApplicationBootstrap();

    jest.advanceTimersByTime(1000);
    expect(execute).toHaveBeenCalledTimes(1);
    await expirador.beforeApplicationShutdown();
    jest.advanceTimersByTime(5000);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('loga a quantidade quando algum orçamento expira', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await criar(jest.fn().mockResolvedValue(3)).executarCiclo();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ quantidade: 3 }));
  });

  it('um ciclo por vez, e o desligamento espera o ciclo em andamento', async () => {
    let liberar!: (n: number) => void;
    const execute = jest.fn(() => new Promise<number>((resolve) => (liberar = resolve)));
    const expirador = criar(execute);

    const primeiro = expirador.executarCiclo();
    expect(expirador.executarCiclo()).toBe(primeiro);
    expect(execute).toHaveBeenCalledTimes(1);

    let desligou = false;
    const desligamento = expirador.beforeApplicationShutdown().then(() => (desligou = true));
    await Promise.resolve();
    expect(desligou).toBe(false);
    liberar(2);
    await desligamento;
    expect(desligou).toBe(true);
  });

  it('erro no ciclo vira log', async () => {
    const erro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(
      criar(jest.fn().mockRejectedValue(new Error('banco fora'))).executarCiclo(),
    ).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalledWith(
      expect.objectContaining({ erro: { name: 'Error', message: 'banco fora' } }),
    );
  });
});
