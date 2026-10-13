import { Inject, Injectable } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { Orcamento } from '../../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { BILLING_EVENTS, DecisaoOrcamentoPayload } from '../../billing-messages';
import { criarEnvelope } from '../../ports/message-envelope';
import { IOutbox } from '../../ports/outbox';
import { IRelogio } from '../../ports/relogio';
import { ITransactionManager } from '../../ports/transaction-manager';
import { ConsultarOrcamentoPublicoUseCase } from '../consultar-orcamento-publico/ConsultarOrcamentoPublicoUseCase';

export const DECISOES = ['APROVADA', 'REPROVADA'] as const;
export type Decisao = (typeof DECISOES)[number];

export interface DecidirOrcamentoInput {
  numeroOs: number;
  token: string;
  decisao: Decisao;
}

/**
 * Decisão do cliente. Só ENVIADO aceita decisão (uso único do token); corrida com o job de
 * expiração ou com outra aba do cliente vira ConcorrenciaError (409).
 */
@Injectable()
export class DecidirOrcamentoUseCase {
  constructor(
    @Inject(INJECTION_TOKENS.TRANSACTION_MANAGER)
    private readonly transacao: ITransactionManager,
    private readonly consultar: ConsultarOrcamentoPublicoUseCase,
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
    @Inject(INJECTION_TOKENS.OUTBOX)
    private readonly outbox: IOutbox,
    @Inject(INJECTION_TOKENS.RELOGIO)
    private readonly relogio: IRelogio,
  ) {}

  execute(input: DecidirOrcamentoInput): Promise<Orcamento> {
    return this.transacao.run(async () => {
      const orcamento = await this.consultar.execute(input.numeroOs, input.token);
      const agora = this.relogio.agora();
      const aprovado = input.decisao === 'APROVADA';
      if (aprovado) {
        orcamento.aprovar(agora);
      } else {
        orcamento.reprovar(agora);
      }
      await this.orcamentos.salvar(orcamento);
      await this.outbox.publicar(
        criarEnvelope<DecisaoOrcamentoPayload>(
          aprovado ? BILLING_EVENTS.ORCAMENTO_APROVADO : BILLING_EVENTS.ORCAMENTO_REPROVADO,
          orcamento.osId,
          { osId: orcamento.osId, orcamentoId: orcamento.id.toValue() },
        ),
      );
      return orcamento;
    });
  }
}
