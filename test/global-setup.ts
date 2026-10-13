import { execSync } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL ??=
    'postgresql://billing:billing@localhost:5435/billing_test?schema=public';
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
