-- CreateEnum
CREATE TYPE "StatusOrcamento" AS ENUM ('ENVIADO', 'APROVADO', 'REPROVADO', 'EXPIRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PAGA', 'RECUSADA');

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "numeroOs" INTEGER NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "clienteEmail" TEXT NOT NULL,
    "itens" JSONB NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "status" "StatusOrcamento" NOT NULL,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "decididoEm" TIMESTAMP(3),
    "versao" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "preferenceId" TEXT NOT NULL,
    "initPoint" TEXT NOT NULL,
    "status" "StatusCobranca" NOT NULL,
    "mpPaymentId" TEXT,
    "versao" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "mpPaymentId" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "payloadBruto" JSONB NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("mpPaymentId")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "traceparent" TEXT,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedMessage" (
    "messageId" TEXT NOT NULL,
    "processadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMessage_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_osId_key" ON "Orcamento"("osId");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_numeroOs_key" ON "Orcamento"("numeroOs");

-- CreateIndex
CREATE INDEX "Orcamento_status_validoAte_idx" ON "Orcamento"("status", "validoAte");

-- CreateIndex
CREATE INDEX "Cobranca_osId_idx" ON "Cobranca"("osId");

-- CreateIndex
CREATE INDEX "Pagamento_cobrancaId_idx" ON "Pagamento"("cobrancaId");

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_seq_key" ON "Outbox"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_messageId_key" ON "Outbox"("messageId");

-- CreateIndex
CREATE INDEX "Outbox_publicadoEm_seq_idx" ON "Outbox"("publicadoEm", "seq");

-- Índices parciais (o schema Prisma não expressa índice com WHERE).
-- Seleção de cabeças da outbox: DISTINCT ON "groupId" ORDER BY "groupId", "seq" só entre pendentes.
CREATE INDEX "Outbox_pendentes_grupo_idx" ON "Outbox"("groupId", "seq") WHERE "publicadoEm" IS NULL;

-- No máximo uma cobrança PENDENTE por OS: dois gerar-cobranca concorrentes não criam dois links.
CREATE UNIQUE INDEX "Cobranca_osId_pendente_key" ON "Cobranca"("osId") WHERE "status" = 'PENDENTE';
