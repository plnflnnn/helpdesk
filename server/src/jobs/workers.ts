import type { Job, PgBoss } from 'pg-boss';
import type { Database } from '@/db.js';
import type { Env } from '@/env.js';
import { createTicketHandlers, type TicketTask } from '@/jobs/handlers.js';
import { AUTO_RESOLVE_TICKET, CLASSIFY_TICKET, type TicketJob } from '@/jobs/queue.js';
import type { Mailer } from '@/services/email.js';
import { captureException } from '@/sentry.js';

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
  // Without a handler, jobs wait in the queue (up to 14 days) until a worker restarts that has one.
  const { classify, autoResolve } = await createTicketHandlers({ db, mailer, env });

  if (classify) {
    await boss.work<TicketJob>(
      CLASSIFY_TICKET,
      { localConcurrency: 5 },
      ticketHandler('Classifying', classify),
    );
  }

  if (autoResolve) {
    await boss.work<TicketJob>(
      AUTO_RESOLVE_TICKET,
      { localConcurrency: 5 },
      ticketHandler('Auto-resolving', autoResolve),
    );
  }
}

/** Runs one ticket job, logging failures before pg-boss retries them. */
function ticketHandler(task: string, run: TicketTask) {
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
