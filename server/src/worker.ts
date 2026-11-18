import { createPrismaClient } from '@/db.js';
import { parseEnv } from '@/env.js';
import { CLASSIFY_TICKET, startBoss, type ClassifyTicketJob } from '@/jobs/queue.js';
import { createAiModel } from '@/services/ai.js';
import { classifyTicket } from '@/services/ticket-classification.js';

// Background worker: runs the jobs the web server queues. Started separately (`npm run dev:worker`, or `start:worker` in production).

const env = parseEnv(process.env);
const db = createPrismaClient(env.DATABASE_URL);
const boss = await startBoss(env.DATABASE_URL);
const model = createAiModel(env);

if (model) {
  await boss.work<ClassifyTicketJob>(CLASSIFY_TICKET, { localConcurrency: 5 }, async ([job]) => {
    const { ticketId } = job!.data;
    try {
      await classifyTicket({ db, model, ticketId });
    } catch (error) {
      console.error(
        `Classifying ticket ${ticketId} failed (attempt ${job!.retryCount + 1})`,
        error,
      );
      throw error; // pg-boss retries it
    }
  });
} else {
  // Jobs wait in the queue (up to 14 days) until the worker restarts with a key.
  console.warn('OPENAI_API_KEY is not set: tickets will not be classified until it is');
}

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
