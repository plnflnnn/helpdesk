import { PgBoss } from 'pg-boss';

/** Queue names. */
export const CLASSIFY_TICKET = 'classify-ticket';
export const AUTO_RESOLVE_TICKET = 'auto-resolve-ticket';

/** Data of every ticket job. */
export type TicketJob = { ticketId: number };

/** Puts work on the background queue. The web server only sends jobs; the worker runs them. */
export type JobQueue = {
  /** Queues AI classification of a new ticket. Resolves once the job is saved, not when it has run. */
  classifyTicket(ticketId: number): Promise<void>;
  /** Queues an attempt to answer and resolve a new ticket from the knowledge base. */
  autoResolveTicket(ticketId: number): Promise<void>;
};

/** 3 retries with increasing delays (about 5s, 10s, 20s), then the job is marked failed. */
const retryOptions = { retryLimit: 3, retryDelay: 5, retryBackoff: true, expireInSeconds: 120 };

/** Starts pg-boss (creating its `pgboss` schema on first run) and makes sure every queue exists. */
export async function startBoss(connectionString: string) {
  const boss = new PgBoss(connectionString);
  boss.on('error', (error) => console.error('pg-boss error', error));
  await boss.start();
  // When classification fails for good, the ticket stays unclassified: agents set it by hand.
  await ensureQueue(boss, CLASSIFY_TICKET, retryOptions);
  // When auto-resolving fails for good, the ticket simply stays open for agents.
  await ensureQueue(boss, AUTO_RESOLVE_TICKET, retryOptions);
  return boss;
}

export function createJobQueue(boss: PgBoss): JobQueue {
  // The singleton key stops a ticket from being queued twice while a job for it is waiting.
  const sendTicketJob = async (queue: string, ticketId: number) => {
    const data: TicketJob = { ticketId };
    await boss.send(queue, data, { singletonKey: String(ticketId) });
  };
  return {
    classifyTicket: (ticketId) => sendTicketJob(CLASSIFY_TICKET, ticketId),
    autoResolveTicket: (ticketId) => sendTicketJob(AUTO_RESOLVE_TICKET, ticketId),
  };
}

type QueueOptions = NonNullable<Parameters<PgBoss['createQueue']>[1]>;

/** Creates the queue unless it exists. The web server and worker both call this at startup. */
async function ensureQueue(boss: PgBoss, name: string, options: QueueOptions) {
  if (await boss.getQueue(name)) {
    return;
  }
  try {
    await boss.createQueue(name, options);
  } catch (error) {
    // The other process may have created it at the same moment.
    if (!(await boss.getQueue(name))) {
      throw error;
    }
  }
}
