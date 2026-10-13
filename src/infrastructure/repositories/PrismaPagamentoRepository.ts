import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  IPagamentoRepository,
  RegistroPagamento,
} from '../../domain/cobranca/repositories/IPagamentoRepository';
import { PrismaTransactionManager } from '../database/prisma-transaction.manager';

@Injectable()
export class PrismaPagamentoRepository implements IPagamentoRepository {
  constructor(private readonly db: PrismaTransactionManager) {}

  async registrar(pagamento: RegistroPagamento): Promise<void> {
    const dados = {
      cobrancaId: pagamento.cobrancaId,
      status: pagamento.status,
      valor: pagamento.valor,
      payloadBruto: (pagamento.payloadBruto ?? {}) as Prisma.InputJsonValue,
    };
    await this.db.client.pagamento.upsert({
      where: { mpPaymentId: pagamento.mpPaymentId },
      create: { mpPaymentId: pagamento.mpPaymentId, ...dados },
      update: dados,
    });
  }
}
