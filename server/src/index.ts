import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { createPrismaClient, isDatabaseUp } from './db.js';
import { parseEnv } from './env.js';

const env = parseEnv(process.env);
const db = createPrismaClient(env.DATABASE_URL);

const app = createApp({
  checkDatabase: () => isDatabaseUp(db),
  services: { db, auth: createAuth(db, env), appUrl: env.APP_URL },
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
