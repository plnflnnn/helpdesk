import { fileURLToPath } from 'node:url';
import { createOpenAI } from '@ai-sdk/openai';
import { createApp } from '@/app.js';
import { createAuth } from '@/auth.js';
import { createPrismaClient, isDatabaseUp } from '@/db.js';
import { parseEnv } from '@/env.js';
import { createConsoleMailer, createSendGridMailer } from '@/services/email.js';

const env = parseEnv(process.env);
const db = createPrismaClient(env.DATABASE_URL);

if (env.NODE_ENV === 'production' && !(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL)) {
  throw new Error('SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are required in production');
}
const mailer =
  env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL
    ? createSendGridMailer({ apiKey: env.SENDGRID_API_KEY, from: env.SENDGRID_FROM_EMAIL })
    : createConsoleMailer(env.SENDGRID_FROM_EMAIL);

const app = createApp({
  checkDatabase: () => isDatabaseUp(db),
  services: {
    db,
    auth: createAuth(db, env),
    aiModel: env.OPENAI_API_KEY
      ? createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.OPENAI_MODEL)
      : undefined,
    mailer,
  },
  clientDistPath:
    env.NODE_ENV === 'production'
      ? fileURLToPath(new URL('../../../client/dist', import.meta.url))
      : undefined,
});

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
