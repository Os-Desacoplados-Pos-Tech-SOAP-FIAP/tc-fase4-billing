import { DomainError } from '../../shared/DomainError';
import { Entity, EntityProps } from '../../shared/Entity';
import { UniqueID } from '../../shared/UniqueID';

export enum StatusOrcamento {
  ENVIADO = 'ENVIADO',
  APROVADO = 'APROVADO',
  REPROVADO = 'REPROVADO',
  EXPIRADO = 'EXPIRADO',
  CANCELADO = 'CANCELADO',
}

export enum TipoItemOrcamento {
  SERVICO = 'SERVICO',
  INSUMO = 'INSUMO',
}

/** Snapshot do item como o OS o enviou (nome e preço já resolvidos no Catalog). */
export interface ItemOrcamento {
  itemId: string;
  tipo: TipoItemOrcamento;
  referenciaId: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

export interface ClienteOrcamento {
  nome: string;
  email: string;
}

export interface NovoOrcamento {
  osId: string;
  numeroOs: number;
  cliente: ClienteOrcamento;
  itens: ItemOrcamento[];
  validoAte: Date;
  tokenHash: string;
}

export interface OrcamentoProps extends EntityProps, NovoOrcamento {
  valorTotal: number;
  status: StatusOrcamento;
  decididoEm: Date | null;
  /** Versão lida do banco (0 = ainda não persistido). */
  versao: number;
}

/** Limite do Decimal(10,2) da coluna de valor. */
const VALOR_TOTAL_MAXIMO = 99_999_999.99;

const CANCELAVEIS: ReadonlySet<StatusOrcamento> = new Set([
  StatusOrcamento.ENVIADO,
  StatusOrcamento.APROVADO,
]);

/**
 * Orçamento de uma OS. Só ENVIADO aceita decisão do cliente (o que torna o token de uso
 * único); cancelar é a compensação da saga e vale de ENVIADO ou APROVADO.
 */
export class Orcamento extends Entity<OrcamentoProps> {
  private constructor(props: OrcamentoProps, id?: UniqueID) {
    super(props, id);
  }

  public static criar(novo: NovoOrcamento): Orcamento {
    if (!novo.osId || novo.osId.trim() === '') {
      throw new DomainError('OS do orçamento é obrigatória', 'ORCAMENTO_OS_OBRIGATORIA');
    }
    if (!Number.isInteger(novo.numeroOs) || novo.numeroOs < 1) {
      throw new DomainError('Número da OS inválido', 'ORCAMENTO_NUMERO_INVALIDO');
    }
    if (!novo.cliente?.email?.includes('@')) {
      throw new DomainError('E-mail do cliente inválido', 'ORCAMENTO_EMAIL_INVALIDO');
    }
    if (novo.itens.length === 0) {
      throw new DomainError('Orçamento precisa de ao menos um item', 'ORCAMENTO_SEM_ITENS');
    }
    validarItens(novo.itens);
    const valorTotal = somarEmCentavos(novo.itens);
    if (valorTotal === 0) {
      throw new DomainError('Orçamento sem valor a cobrar', 'ORCAMENTO_VALOR_ZERO');
    }
    if (valorTotal > VALOR_TOTAL_MAXIMO) {
      throw new DomainError('Valor total do orçamento excede o limite', 'ORCAMENTO_VALOR_EXCEDIDO');
    }
    return new Orcamento({
      ...novo,
      cliente: { ...novo.cliente },
      itens: novo.itens.map((item) => ({ ...item })),
      validoAte: new Date(novo.validoAte),
      valorTotal,
      status: StatusOrcamento.ENVIADO,
      decididoEm: null,
      versao: 0,
    });
  }

  public static restaurar(props: OrcamentoProps, id: UniqueID): Orcamento {
    return new Orcamento(
      {
        ...props,
        cliente: { ...props.cliente },
        itens: props.itens.map((item) => ({ ...item })),
      },
      id,
    );
  }

  public get osId(): string {
    return this.props.osId;
  }

  public get numeroOs(): number {
    return this.props.numeroOs;
  }

  public get cliente(): ClienteOrcamento {
    return { ...this.props.cliente };
  }

  public get itens(): ItemOrcamento[] {
    return this.props.itens.map((item) => ({ ...item }));
  }

  public get valorTotal(): number {
    return this.props.valorTotal;
  }

  public get status(): StatusOrcamento {
    return this.props.status;
  }

  public get validoAte(): Date {
    return new Date(this.props.validoAte);
  }

  public get tokenHash(): string {
    return this.props.tokenHash;
  }

  public get decididoEm(): Date | null {
    return this.props.decididoEm && new Date(this.props.decididoEm);
  }

  public get versao(): number {
    return this.props.versao;
  }

  public vencido(agora: Date): boolean {
    return agora.getTime() > this.props.validoAte.getTime();
  }

  public aprovar(agora: Date): void {
    this.decidir(StatusOrcamento.APROVADO, agora);
  }

  public reprovar(agora: Date): void {
    this.decidir(StatusOrcamento.REPROVADO, agora);
  }

  public expirar(agora: Date): void {
    if (this.props.status !== StatusOrcamento.ENVIADO || !this.vencido(agora)) {
      throw new DomainError(
        `Orçamento da OS ${this.props.numeroOs} não pode expirar`,
        'ORCAMENTO_NAO_EXPIRAVEL',
      );
    }
    this.props.status = StatusOrcamento.EXPIRADO;
    this.touch();
  }

  public podeSerCancelado(): boolean {
    return CANCELAVEIS.has(this.props.status);
  }

  public cancelar(): void {
    if (!this.podeSerCancelado()) {
      throw new DomainError(
        `Orçamento ${this.props.status} não pode ser cancelado`,
        'ORCAMENTO_NAO_CANCELAVEL',
      );
    }
    this.props.status = StatusOrcamento.CANCELADO;
    this.touch();
  }

  private decidir(status: StatusOrcamento, agora: Date): void {
    if (this.props.status !== StatusOrcamento.ENVIADO) {
      throw new DomainError('Orçamento já foi decidido', 'ORCAMENTO_JA_DECIDIDO');
    }
    if (this.vencido(agora)) {
      throw new DomainError('Orçamento vencido', 'ORCAMENTO_VENCIDO');
    }
    this.props.status = status;
    this.props.decididoEm = agora;
    this.touch();
  }
}

function validarItens(itens: ItemOrcamento[]): void {
  const ids = new Set<string>();
  for (const item of itens) {
    if (ids.has(item.itemId)) {
      throw new DomainError(`Item ${item.itemId} repetido`, 'ORCAMENTO_ITEM_DUPLICADO');
    }
    ids.add(item.itemId);
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
      throw new DomainError(
        `Quantidade inválida no item ${item.itemId}`,
        'ORCAMENTO_QUANTIDADE_INVALIDA',
      );
    }
    if (
      !Number.isFinite(item.valorUnitario) ||
      item.valorUnitario < 0 ||
      temMaisDeDuasCasas(item.valorUnitario)
    ) {
      throw new DomainError(`Valor inválido no item ${item.itemId}`, 'ORCAMENTO_VALOR_INVALIDO');
    }
  }
}

/** Soma em centavos para não acumular erro de ponto flutuante (0,1 × 3 = 0,30). */
function somarEmCentavos(itens: ItemOrcamento[]): number {
  const centavos = itens.reduce(
    (total, item) => total + Math.round(item.valorUnitario * 100) * item.quantidade,
    0,
  );
  return centavos / 100;
}

function temMaisDeDuasCasas(valor: number): boolean {
  return Math.abs(Math.round(valor * 100) - valor * 100) > 1e-6;
}
