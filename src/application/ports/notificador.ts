export interface Email {
  para: string;
  assunto: string;
  corpo: string;
}

/** Envio de e-mail ao cliente. Chamado depois do commit; falha não desfaz nada. */
export interface INotificador {
  enviar(email: Email): Promise<void>;
}
