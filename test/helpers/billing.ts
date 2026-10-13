import { INestApplication } from '@nestjs/common';

import { Email, INotificador } from '../../src/application/ports/notificador';
import { INJECTION_TOKENS } from '../../src/common/constants/injection-tokens';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

/** Intercepta o notificador para ler o link (e o token) que iria por e-mail. */
export function capturarEmails(app: INestApplication): Email[] {
  const emails: Email[] = [];
  jest
    .spyOn(app.get<INotificador>(INJECTION_TOKENS.NOTIFICADOR), 'enviar')
    .mockImplementation(async (email) => {
      emails.push(email);
    });
  return emails;
}

export function tokenDoUltimoEmail(emails: Email[]): string {
  const token = /token=([\w-]+)/.exec(emails.at(-1)?.corpo ?? '')?.[1];
  if (!token) throw new Error('nenhum token nos e-mails capturados');
  return token;
}

export async function tiposNaOutbox(prisma: PrismaService): Promise<string[]> {
  return (await prisma.outbox.findMany({ orderBy: { seq: 'asc' } })).map((o) => o.type);
}
