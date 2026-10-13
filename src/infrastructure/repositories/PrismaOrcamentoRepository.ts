import { Injectable } from '@nestjs/common';
import {
  Orcamento as OrcamentoRow,
  Prisma,
  StatusOrcamento as StatusOrcamentoRow,
} from '@prisma/client';

import { ConcorrenciaError } from '../../application/errors';
import {
  ItemOrcamento,
  Orcamento,
  StatusOrcamento,
} from '../../domain/orcamento/entities/Orcamento';
import { IOrcamentoRepository } from '../../domain/orcamento/repositories/IOrcamentoRepository';
import { UniqueID } from '../../domain/shared/UniqueID';
import { PrismaTransactionManager } from '../database/prisma-transaction.manager';

@Injectable()
export class PrismaOrcamentoRepository implements IOrcamentoRepository {
  constructor(private readonly db: PrismaTransactionManager) {}

  async salvar(orcamento: Orcamento): Promise<void> {
    if (orcamento.versao === 0) {
      await this.db.client.orcamento.create({
        data: {
          id: orcamento.id.toValue(),
          osId: orcamento.osId,
          numeroOs: orcamento.numeroOs,
          clienteNome: orcamento.cliente.nome,
          clienteEmail: orcamento.cliente.email,
          itens: orcamento.itens as unknown as Prisma.InputJsonValue,
          valorTotal: orcamento.valorTotal,
          status: StatusOrcamentoRow[orcamento.status],
          validoAte: orcamento.validoAte,
          tokenHash: orcamento.tokenHash,
          decididoEm: orcamento.decididoEm,
          versao: 1,
        },
      });
      return;
    }
    // Depois de criado, só status e data da decisão mudam.
    const { count } = await this.db.client.orcamento.updateMany({
      where: { id: orcamento.id.toValue(), versao: orcamento.versao },
      data: {
        status: StatusOrcamentoRow[orcamento.status],
        decididoEm: orcamento.decididoEm,
        versao: { increment: 1 },
      },
    });
    if (count === 0) throw new ConcorrenciaError('Orçamento');
  }

  async buscarPorOs(osId: string): Promise<Orcamento | null> {
    const row = await this.db.client.orcamento.findUnique({ where: { osId } });
    return row ? paraDominio(row) : null;
  }

  async buscarPorNumeroOs(numeroOs: number): Promise<Orcamento | null> {
    const row = await this.db.client.orcamento.findUnique({ where: { numeroOs } });
    return row ? paraDominio(row) : null;
  }

  async listarVencidos(agora: Date, limite: number): Promise<Orcamento[]> {
    const rows = await this.db.client.orcamento.findMany({
      where: { status: StatusOrcamentoRow.ENVIADO, validoAte: { lt: agora } },
      orderBy: { validoAte: 'asc' },
      take: limite,
    });
    return rows.map(paraDominio);
  }
}

function paraDominio(row: OrcamentoRow): Orcamento {
  return Orcamento.restaurar(
    {
      osId: row.osId,
      numeroOs: row.numeroOs,
      cliente: { nome: row.clienteNome, email: row.clienteEmail },
      itens: row.itens as unknown as ItemOrcamento[],
      valorTotal: row.valorTotal.toNumber(),
      status: StatusOrcamento[row.status],
      validoAte: row.validoAte,
      tokenHash: row.tokenHash,
      decididoEm: row.decididoEm,
      versao: row.versao,
      criadoEm: row.criadoEm,
      atualizadoEm: row.atualizadoEm,
    },
    new UniqueID(row.id),
  );
}
