import { Module } from '@nestjs/common';

import { BuscarOrcamentoUseCase } from '../../application/orcamento/buscar-orcamento/BuscarOrcamentoUseCase';
import { CancelarOrcamentoUseCase } from '../../application/orcamento/cancelar-orcamento/CancelarOrcamentoUseCase';
import { ConsultarOrcamentoPublicoUseCase } from '../../application/orcamento/consultar-orcamento-publico/ConsultarOrcamentoPublicoUseCase';
import { DecidirOrcamentoUseCase } from '../../application/orcamento/decidir-orcamento/DecidirOrcamentoUseCase';
import { ExpirarOrcamentosUseCase } from '../../application/orcamento/expirar-orcamentos/ExpirarOrcamentosUseCase';
import { GerarOrcamentoUseCase } from '../../application/orcamento/gerar-orcamento/GerarOrcamentoUseCase';
import { ExpiradorDeOrcamentos } from './expirador-de-orcamentos';
import { OrcamentoMessageHandlers } from './orcamento-message.handlers';
import { OrcamentoPublicoController } from './orcamento-publico.controller';
import { OrcamentoController } from './orcamento.controller';

@Module({
  controllers: [OrcamentoPublicoController, OrcamentoController],
  providers: [
    GerarOrcamentoUseCase,
    CancelarOrcamentoUseCase,
    ConsultarOrcamentoPublicoUseCase,
    DecidirOrcamentoUseCase,
    ExpirarOrcamentosUseCase,
    BuscarOrcamentoUseCase,
    OrcamentoMessageHandlers,
    ExpiradorDeOrcamentos,
  ],
})
export class OrcamentoModule {}
