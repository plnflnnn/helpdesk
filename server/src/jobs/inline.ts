import type { TicketHandlers, TicketTask } from '@/jobs/handlers.js';
import type { JobQueue } from '@/jobs/queue.js';
import { captureException, flush } from '@/sentry.js';

type InlineJobQueueOptions = {
  /**
   * Keeps the work running after the response is sent. On Vercel this is `waitUntil`, which keeps
   * the function alive until the promise settles (up to the function's max duration).
   */
  defer: (work: Promise<unknown>) => void;
  /** Waits between attempts; its length is the number of retries. Defaults to 5s, then 10s. */
  retryDelaysMs?: number[];
  /** Aborts an attempt that runs longer than this. */
  attemptTimeoutMs?: number;
};

/**
 * A job queue for serverless hosts, where no worker process runs between requests: each job runs
 * in the same function invocation, right after the response. Unlike pg-boss, a job is lost if the
 * invocation dies, and it is not stored anywhere: a failed ticket simply stays for agents to handle.
 */
export function createInlineJobQueue(
  handlers: TicketHandlers,
  { defer, retryDelaysMs = [5_000, 10_000], attemptTimeoutMs = 60_000 }: InlineJobQueueOptions,
): JobQueue {
  const run = (task: string, handler: TicketTask | undefined, ticketId: number) => {
    if (!handler) return Promise.resolve();
    defer(runWithRetries(task, handler, ticketId, retryDelaysMs, attemptTimeoutMs));
    return Promise.resolve();
  };
  return {
    classifyTicket: (ticketId) => run('Classifying', handlers.classify, ticketId),
    autoResolveTicket: (ticketId) => run('Auto-resolving', handlers.autoResolve, ticketId),
  };
}

async function runWithRetries(
  task: string,
  handler: TicketTask,
  ticketId: number,
  retryDelaysMs: number[],
  attemptTimeoutMs: number,
) {
  for (let attempt = 1; ; attempt++) {
    try {
      await handler(ticketId, AbortSignal.timeout(attemptTimeoutMs));
      return;
    } catch (error) {
      console.error(`${task} ticket ${ticketId} failed (attempt ${attempt})`, error);
      captureException(error, { extra: { task, ticketId, attempt } });
      const delay = retryDelaysMs[attempt - 1];
      if (delay === undefined) {
        // The function may be frozen right after this, so send the error report now.
        await flush(2_000);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
