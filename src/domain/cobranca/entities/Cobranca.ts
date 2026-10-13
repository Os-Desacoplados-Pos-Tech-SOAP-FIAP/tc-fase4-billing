import { DomainError } from '../../shared/DomainError';
import { Entity, EntityProps } from '../../shared/Entity';
import { UniqueID } from '../../shared/UniqueID';

export enum StatusCobranca {
  PENDENTE = 'PENDENTE',
  PAGA = 'PAGA',
  RECUSADA = 'RECUSADA',
}

export interface NovaCobranca {
  osId: string;
  orcamentoId: string;
  valor: number;
  preferenceId: string;
  initPoint: string;
}

export interface CobrancaProps extends EntityProps, NovaCobranca {
  status: StatusCobranca;
  mpPaymentId: string | null;
  /** Versão lida do banco (0 = ainda não persistida). */
  versao: number;
}

/**
 * Cobrança de uma OS finalizada (link do Checkout Pro). Uma recusa encerra o link para a
 * saga, mas um pagamento aprovado que chegue depois no mesmo link ainda confirma.
 */
export class Cobranca extends Entity<CobrancaProps> {
  private constructor(props: CobrancaProps, id?: UniqueID) {
    super(props, id);
  }

  /** O id vem de fora porque é enviado ao gateway antes de a cobrança ser gravada. */
  public static criar(nova: NovaCobranca, id: UniqueID): Cobranca {
    if (!(nova.valor > 0)) {
      throw new DomainError('Valor da cobrança deve ser positivo', 'COBRANCA_VALOR_INVALIDO');
    }
    return new Cobranca(
      { ...nova, status: StatusCobranca.PENDENTE, mpPaymentId: null, versao: 0 },
      id,
    );
  }

  public static restaurar(props: CobrancaProps, id: UniqueID): Cobranca {
    return new Cobranca({ ...props }, id);
  }

  public get osId(): string {
    return this.props.osId;
  }

  public get orcamentoId(): string {
    return this.props.orcamentoId;
  }

  public get valor(): number {
    return this.props.valor;
  }

  public get preferenceId(): string {
    return this.props.preferenceId;
  }

  public get initPoint(): string {
    return this.props.initPoint;
  }

  public get status(): StatusCobranca {
    return this.props.status;
  }

  public get mpPaymentId(): string | null {
    return this.props.mpPaymentId;
  }

  public get versao(): number {
    return this.props.versao;
  }

  public confirmar(mpPaymentId: string): void {
    if (this.props.status === StatusCobranca.PAGA) {
      throw new DomainError('Cobrança já está paga', 'COBRANCA_JA_PAGA');
    }
    this.props.status = StatusCobranca.PAGA;
    this.props.mpPaymentId = mpPaymentId;
    this.touch();
  }

  public recusar(mpPaymentId: string): void {
    if (this.props.status !== StatusCobranca.PENDENTE) {
      throw new DomainError('Cobrança não está pendente', 'COBRANCA_NAO_PENDENTE');
    }
    this.props.status = StatusCobranca.RECUSADA;
    this.props.mpPaymentId = mpPaymentId;
    this.touch();
  }
}
