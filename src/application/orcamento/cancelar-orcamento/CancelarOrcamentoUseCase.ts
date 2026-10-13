import { Inject, Injectable, Logger } from '@nestjs/common';

import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { IOrcamentoRepository } from '../../../domain/orcamento/repositories/IOrcamentoRepository';
import { BILLING_EVENTS, OrcamentoCanceladoPayload } from '../../billing-messages';
import { emailOrcamentoCancelado } from '../../emails';
import { notificarSemFalhar } from '../../notificar';
import { ContextoMensagem, criarEnvelope } from '../../ports/message-envelope';
import { Email, INotificador } from '../../ports/notificador';
import { IOutbox } from '../../ports/outbox';
import { IProcessedMessageRepository } from '../../ports/processed-message.repository';
import { ITransactionManager } from '../../ports/transaction-manager';

export interface CancelarOrcamentoInput extends ContextoMensagem {
  motivo?: string;
}

/**
 * Compensação da saga. Sempre confirma com orcamento-cancelado: sem orçamento, ou já
 * reprovado/expirado/cancelado, não há o que desfazer, mas o orquestrador precisa da resposta.
 */
@Injectable()
export class CancelarOrcamentoUseCase {
  private readonly logger = new Logger(CancelarOrcamentoUseCase.name);

  constructor(
    @Inject(INJECTION_TOKENS.TRANSACTION_MANAGER)
    private readonly transacao: ITransactionManager,
    @Inject(INJECTION_TOKENS.PROCESSED_MESSAGE_REPOSITORY)
    private readonly mensagensProcessadas: IProcessedMessageRepository,
    @Inject(INJECTION_TOKENS.ORCAMENTO_REPOSITORY)
    private readonly orcamentos: IOrcamentoRepository,
    @Inject(INJECTION_TOKENS.OUTBOX)
    private readonly outbox: IOutbox,
    @Inject(INJECTION_TOKENS.NOTIFICADOR)
    private readonly notificador: INotificador,
  ) {}

  async execute(input: CancelarOrcamentoInput): Promise<void> {
    const email = await this.transacao.run(() => this.cancelar(input));
    if (email) await notificarSemFalhar(this.notificador, email, this.logger, input.correlationId);
  }

  private async cancelar(input: CancelarOrcamentoInput): Promise<Email | null> {
    if (!(await this.mensagensProcessadas.registrar(input.messageId))) return null;

    let email: Email | null = null;
    const orcamento = await this.orcamentos.buscarPorOs(input.correlationId);
    if (orcamento?.podeSerCancelado()) {
      orcamento.cancelar();
      await this.orcamentos.salvar(orcamento);
      email = emailOrcamentoCancelado(orcamento, input.motivo);
    }

    await this.outbox.publicar(
      criarEnvelope<OrcamentoCanceladoPayload>(
        BILLING_EVENTS.ORCAMENTO_CANCELADO,
        input.correlationId,
        { osId: input.correlationId },
        input.messageId,
      ),
    );
    return email;
  }
}
