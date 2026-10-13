import { Email, INotificador } from '../../src/application/ports/notificador';

export class InMemoryNotificador implements INotificador {
  public emails: Email[] = [];
  public falhar = false;

  async enviar(email: Email): Promise<void> {
    if (this.falhar) throw new Error('SMTP indisponível');
    this.emails.push(email);
  }

  /** Extrai o token do link do último e-mail de orçamento. */
  ultimoToken(): string {
    const corpo = this.emails.at(-1)?.corpo ?? '';
    const token = /token=([\w-]+)/.exec(corpo)?.[1];
    if (!token) throw new Error('nenhum token nos e-mails enviados');
    return token;
  }
}
