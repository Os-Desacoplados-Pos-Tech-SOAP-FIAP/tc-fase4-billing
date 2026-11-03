export interface Email {
  para: string;
  assunto: string;
  corpo: string;
  /** Versão HTML opcional; o texto de `corpo` vai junto para quem não lê HTML. */
  html?: string;
}

/** Envio de e-mail ao cliente. Chamado depois do commit; falha não desfaz nada. */
export interface INotificador {
  enviar(email: Email): Promise<void>;
}
