import { Injectable } from '@nestjs/common';
import { Cobranca as CobrancaRow, StatusCobranca as StatusCobrancaRow } from '@prisma/client';

import { ConcorrenciaError } from '../../application/errors';
import { Cobranca, StatusCobranca } from '../../domain/cobranca/entities/Cobranca';
import { ICobrancaRepository } from '../../domain/cobranca/repositories/ICobrancaRepository';
import { UniqueID } from '../../domain/shared/UniqueID';
import { PrismaTransactionManager } from '../database/prisma-transaction.manager';

@Injectable()
export class PrismaCobrancaRepository implements ICobrancaRepository {
  constructor(private readonly db: PrismaTransactionManager) {}

  async salvar(cobranca: Cobranca): Promise<void> {
    if (cobranca.versao === 0) {
      await this.db.client.cobranca.create({
        data: {
          id: cobranca.id.toValue(),
          osId: cobranca.osId,
          orcamentoId: cobranca.orcamentoId,
          valor: cobranca.valor,
          preferenceId: cobranca.preferenceId,
          initPoint: cobranca.initPoint,
          status: StatusCobrancaRow[cobranca.status],
          mpPaymentId: cobranca.mpPaymentId,
          versao: 1,
        },
      });
      return;
    }
    const { count } = await this.db.client.cobranca.updateMany({
      where: { id: cobranca.id.toValue(), versao: cobranca.versao },
      data: {
        status: StatusCobrancaRow[cobranca.status],
        mpPaymentId: cobranca.mpPaymentId,
        versao: { increment: 1 },
      },
    });
    if (count === 0) throw new ConcorrenciaError('Cobrança');
  }

  async buscarPorId(id: string): Promise<Cobranca | null> {
    const row = await this.db.client.cobranca.findUnique({ where: { id } });
    return row ? paraDominio(row) : null;
  }

  async buscarPendentePorOs(osId: string): Promise<Cobranca | null> {
    return this.primeira(osId, StatusCobrancaRow.PENDENTE);
  }

  async buscarPagaPorOs(osId: string): Promise<Cobranca | null> {
    return this.primeira(osId, StatusCobrancaRow.PAGA);
  }

  async listarPorOs(osId: string): Promise<Cobranca[]> {
    const rows = await this.db.client.cobranca.findMany({
      where: { osId },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(paraDominio);
  }

  private async primeira(osId: string, status: StatusCobrancaRow): Promise<Cobranca | null> {
    const row = await this.db.client.cobranca.findFirst({ where: { osId, status } });
    return row ? paraDominio(row) : null;
  }
}

function paraDominio(row: CobrancaRow): Cobranca {
  return Cobranca.restaurar(
    {
      osId: row.osId,
      orcamentoId: row.orcamentoId,
      valor: row.valor.toNumber(),
      preferenceId: row.preferenceId,
      initPoint: row.initPoint,
      status: StatusCobranca[row.status],
      mpPaymentId: row.mpPaymentId,
      versao: row.versao,
      criadoEm: row.criadoEm,
      atualizadoEm: row.atualizadoEm,
    },
    new UniqueID(row.id),
  );
}
