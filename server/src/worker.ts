import { createPrismaClient } from '@/db.js';
import { parseEnv } from '@/env.js';
import { startBoss } from '@/jobs/queue.js';
import { startJobWorkers } from '@/jobs/workers.js';
import { createMailer } from '@/services/email.js';
import { initSentry } from '@/sentry.js';

// Background worker: runs the jobs the web server queues. Started separately (`npm run dev:worker`,
// or `start:worker` in production), unless the web server runs them itself (`RUN_WORKER=true`).

const env = parseEnv(process.env);
initSentry(env, 'worker');
const db = createPrismaClient(env.DATABASE_URL);
const boss = await startBoss(env.DATABASE_URL);
await startJobWorkers({ boss, db, mailer: createMailer(env), env });

console.log('Worker started');

function shutdown(signal: string) {
  console.log(`${signal} received, stopping worker`);
  // Graceful: waits for running jobs to finish.
  void boss
    .stop({ graceful: true, timeout: 30_000 })
    .finally(() => db.$disconnect())
    .finally(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
