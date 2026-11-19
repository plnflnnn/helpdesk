import { fileURLToPath } from 'node:url';
import { createApp } from '@/app.js';
import { createAuth } from '@/auth.js';
import { createPrismaClient, isDatabaseUp } from '@/db.js';
import { parseEnv } from '@/env.js';
import { createJobQueue, startBoss } from '@/jobs/queue.js';
import { startJobWorkers } from '@/jobs/workers.js';
import { createAiModel } from '@/services/ai.js';
import { createMailer } from '@/services/email.js';
import { initSentry } from '@/sentry.js';

const env = parseEnv(process.env);
initSentry(env, 'api');
const db = createPrismaClient(env.DATABASE_URL);

const mailer = createMailer(env);

// The web server sends jobs; the worker (`npm run dev:worker` / `start:worker`) runs them. With
// RUN_WORKER, the web server runs them too, so a deployment needs no separate worker service.
const boss = await startBoss(env.DATABASE_URL);
if (env.RUN_WORKER) {
  await startJobWorkers({ boss, db, mailer, env });
  console.log('Job worker started in the web process');
}

const app = createApp({
  checkDatabase: () => isDatabaseUp(db),
  services: {
    db,
    auth: createAuth(db, env),
    aiModel: createAiModel(env),
    mailer,
    jobs: createJobQueue(boss),
    inboundEmailSecret: env.SENDGRID_INBOUND_SECRET,
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
    void Promise.allSettled([boss.stop(), db.$disconnect()]).finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
