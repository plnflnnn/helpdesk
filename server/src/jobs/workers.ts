import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Job, PgBoss } from 'pg-boss';
import type { Database } from '@/db.js';
import type { Env } from '@/env.js';
import { AUTO_RESOLVE_TICKET, CLASSIFY_TICKET, type TicketJob } from '@/jobs/queue.js';
import { createAiModel } from '@/services/ai.js';
import type { Mailer } from '@/services/email.js';
import { captureException } from '@/sentry.js';
import { autoResolveTicket, loadKnowledgeBase } from '@/services/ticket-auto-resolve.js';
import { classifyTicket } from '@/services/ticket-classification.js';

type StartJobWorkersParams = {
  boss: PgBoss;
  db: Database;
  mailer: Mailer;
  env: Env;
};

/**
 * Starts running the ticket jobs the web server queues. Used by the standalone worker process, and
 * by the web server itself when `RUN_WORKER` is set (so a single service can do both).
 */
export async function startJobWorkers({ boss, db, mailer, env }: StartJobWorkersParams) {
  const model = createAiModel(env);
  if (!model) {
    // Jobs wait in the queue (up to 14 days) until a worker restarts with a key.
    console.warn('OPENAI_API_KEY is not set: tickets will not be classified or auto-resolved');
    return;
  }

  await boss.work<TicketJob>(
    CLASSIFY_TICKET,
    { localConcurrency: 5 },
    ticketHandler('Classifying', (ticketId, signal) =>
      classifyTicket({ db, model, ticketId, signal }),
    ),
  );

  // Relative to the server folder, whether running from src/jobs/ (tsx) or dist/src/jobs/ (build).
  const serverDir = fileURLToPath(
    new URL(import.meta.url.includes('/dist/') ? '../../..' : '../..', import.meta.url),
  );
  const knowledgeBase = await loadKnowledgeBase(path.resolve(serverDir, env.KNOWLEDGE_BASE_PATH));
  if (!knowledgeBase) {
    console.warn('No knowledge base: new tickets will not be auto-resolved');
    return;
  }

  await boss.work<TicketJob>(
    AUTO_RESOLVE_TICKET,
    { localConcurrency: 5 },
    ticketHandler('Auto-resolving', async (ticketId, signal) => {
      const outcome = await autoResolveTicket({
        db,
        model,
        mailer,
        knowledgeBase,
        ticketId,
        signal,
      });
      console.log(`Auto-resolve ticket ${ticketId}: ${outcome}`);
    }),
  );
}

/** Runs one ticket job, logging failures before pg-boss retries them. */
function ticketHandler(
  task: string,
  run: (ticketId: number, signal: AbortSignal) => Promise<unknown>,
) {
  return async ([job]: Job<TicketJob>[]) => {
    const { ticketId } = job!.data;
    try {
      // The signal aborts when the job expires (`expireInSeconds`), before pg-boss retries it.
      await run(ticketId, job!.signal);
    } catch (error) {
      console.error(`${task} ticket ${ticketId} failed (attempt ${job!.retryCount + 1})`, error);
      captureException(error, { extra: { task, ticketId, attempt: job!.retryCount + 1 } });
      throw error;
    }
  };
}
