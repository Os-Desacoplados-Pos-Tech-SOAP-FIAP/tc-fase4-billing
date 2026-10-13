import { Inject, Injectable, Logger } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { BILLING_EVENTS, DecisaoOrcamentoPayload } from '../../billing-messages';
import { ConcorrenciaError } from '../../errors';
import { criarEnvelope } from '../../ports/message-envelope';
import { IOutbox } from '../../ports/outbox';
import { IRelogio } from '../../ports/relogio';
import { ITransactionManager } from '../../ports/transaction-manager';

const LOTE = 50;

/**
 * Orçamento sem resposta expira (spec §4.6) e a saga trata como reprovação. Cada orçamento
 * vai numa transação própria: conflito com a decisão do cliente (ou com outra réplica
 * expirando o mesmo) só pula aquele orçamento.
 */
@Injectable()
export class ExpirarOrcamentosUseCase {
  private readonly logger = new Logger(ExpirarOrcamentosUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.TRANSACTION_MANAGER)
    private readonly transacao: ITransactionManager,
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
    @Inject(INJECTION_TOKENS.OUTBOX)
    private readonly outbox: IOutbox,
    @Inject(INJECTION_TOKENS.RELOGIO)
    private readonly relogio: IRelogio,
  ) {}

  /** Retorna quantos orçamentos expiraram neste ciclo. */
  async execute(): Promise<number> {
    const agora = this.relogio.agora();
    const vencidos = await this.orcamentos.listarVencidos(agora, LOTE);
    let expirados = 0;
    const erros: unknown[] = [];
    for (const orcamento of vencidos) {
      try {
        if (await this.expirar(orcamento, agora)) expirados++;
      } catch (erro) {
        this.logger.error({
          msg: 'Falha ao expirar orçamento; seguindo para os próximos',
          osId: orcamento.osId,
          erro: erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro),
        });
        erros.push(erro);
      }
    }
    if (erros.length > 0) throw erros[0];
    return expirados;
  }

  private async expirar(orcamento: Orcamento, agora: Date): Promise<boolean> {
    try {
      await this.transacao.run(async () => {
        orcamento.expirar(agora);
        await this.orcamentos.salvar(orcamento);
        await this.outbox.publicar(
          criarEnvelope<DecisaoOrcamentoPayload>(BILLING_EVENTS.ORCAMENTO_EXPIRADO, orcamento.osId, {
            osId: orcamento.osId,
            orcamentoId: orcamento.id.toValue(),
          }),
        );
      });
      return true;
    } catch (erro) {
      if (!(erro instanceof ConcorrenciaError)) throw erro;
      this.logger.log({ msg: 'Orçamento decidido durante a expiração; ignorado', osId: orcamento.osId });
      return false;
    }
  }
}
