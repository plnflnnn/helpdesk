import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Job } from 'pg-boss';
import { createPrismaClient } from '@/db.js';
import { parseEnv } from '@/env.js';
import { AUTO_RESOLVE_TICKET, CLASSIFY_TICKET, startBoss, type TicketJob } from '@/jobs/queue.js';
import { createAiModel } from '@/services/ai.js';
import { createMailer } from '@/services/email.js';
import { autoResolveTicket, loadKnowledgeBase } from '@/services/ticket-auto-resolve.js';
import { classifyTicket } from '@/services/ticket-classification.js';

// Background worker: runs the jobs the web server queues. Started separately (`npm run dev:worker`,
// or `start:worker` in production).

const env = parseEnv(process.env);
const db = createPrismaClient(env.DATABASE_URL);
const mailer = createMailer(env);
const boss = await startBoss(env.DATABASE_URL);
const model = createAiModel(env);

// Relative to the server folder, whether running from src/ (tsx) or dist/src/ (build).
const serverDir = fileURLToPath(
  new URL(import.meta.url.includes('/dist/') ? '../..' : '..', import.meta.url),
);
const knowledgeBase = await loadKnowledgeBase(path.resolve(serverDir, env.KNOWLEDGE_BASE_PATH));

/** Runs one ticket job, logging failures before pg-boss retries them. */
function ticketHandler(task: string, run: (ticketId: number) => Promise<unknown>) {
  return async ([job]: Job<TicketJob>[]) => {
    const { ticketId } = job!.data;
    try {
      await run(ticketId);
    } catch (error) {
      console.error(`${task} ticket ${ticketId} failed (attempt ${job!.retryCount + 1})`, error);
      throw error;
    }
  };
}

if (model) {
  await boss.work<TicketJob>(
    CLASSIFY_TICKET,
    { localConcurrency: 5 },
    ticketHandler('Classifying', (ticketId) => classifyTicket({ db, model, ticketId })),
  );
  if (knowledgeBase) {
    await boss.work<TicketJob>(
      AUTO_RESOLVE_TICKET,
      { localConcurrency: 5 },
      ticketHandler('Auto-resolving', async (ticketId) => {
        const outcome = await autoResolveTicket({ db, model, mailer, knowledgeBase, ticketId });
        console.log(`Auto-resolve ticket ${ticketId}: ${outcome}`);
      }),
    );
  } else {
    console.warn('No knowledge base: new tickets will not be auto-resolved');
  }
} else {
  // Jobs wait in the queue (up to 14 days) until the worker restarts with a key.
  console.warn('OPENAI_API_KEY is not set: tickets will not be classified or auto-resolved');
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
