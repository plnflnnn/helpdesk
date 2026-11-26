import { PgBoss } from 'pg-boss';
import { waitUntil } from '@vercel/functions';
import { autoResolveTicket } from '@/lib/auto-resolve-ticket.js';
import { classifyTicket } from '@/lib/classify-ticket.js';
import Sentry from '@/lib/sentry.js';

type TicketJob = { ticketId: number };
type Handler = (ticketId: number, signal: AbortSignal) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  'classify-ticket': classifyTicket,
  'auto-resolve-ticket': autoResolveTicket,
};

// One queued or running job per ticket; 3 retries about 5s, 10s and 20s apart.
const queueOptions = {
  policy: 'exclusive',
  retryLimit: 3,
  retryDelay: 5,
  retryBackoff: true,
  expireInSeconds: 120,
} as const;

let boss: PgBoss | undefined;

/** Starts pg-boss and runs the jobs in this process. Not used on Vercel. */
export async function startQueue() {
  boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on('error', (error) => {
    Sentry.captureException(error);
    console.error('pg-boss error', error);
  });
  await boss.start();

  for (const [name, run] of Object.entries(handlers)) {
    await boss.createQueue(name, queueOptions);
    await boss.work<TicketJob>(name, { localConcurrency: 5 }, async ([job]) => {
      const { ticketId } = job!.data;
      try {
        await run(ticketId, job!.signal);
      } catch (error) {
        report(name, ticketId, error);
        throw error;
      }
    });
  }
  console.log('Job queue started');
}

export async function stopQueue() {
  await boss?.stop({ graceful: true, timeout: 30_000 });
}

export const sendClassifyJob = (ticketId: number) => sendJob('classify-ticket', ticketId);
export const sendAutoResolveJob = (ticketId: number) => sendJob('auto-resolve-ticket', ticketId);

/** Queues the job, or on Vercel (no long-running worker) runs it right after the response. */
async function sendJob(name: string, ticketId: number) {
  if (process.env.VERCEL) {
    waitUntil(runNow(name, ticketId));
    return;
  }
  if (!boss) {
    throw new Error('The job queue has not been started');
  }
  await boss.send(name, { ticketId }, { singletonKey: String(ticketId) });
}

/** Runs the job in this process, retrying twice (5s, then 10s later). */
export async function runNow(name: string, ticketId: number, retryDelayMs = 5_000) {
  for (let attempt = 1; ; attempt++) {
    try {
      await handlers[name]!(ticketId, AbortSignal.timeout(60_000));
      return;
    } catch (error) {
      report(name, ticketId, error);
      if (attempt === 3) {
        await Sentry.flush(2_000); // The function may be frozen right after.
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * retryDelayMs));
    }
  }
}

function report(name: string, ticketId: number, error: unknown) {
  console.error(`Job ${name} failed for ticket ${ticketId}`, error);
  Sentry.captureException(error, { extra: { job: name, ticketId } });
}
