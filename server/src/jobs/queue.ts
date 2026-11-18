import { PgBoss } from 'pg-boss';

/** Queue names. */
export const CLASSIFY_TICKET = 'classify-ticket';

export type ClassifyTicketJob = { ticketId: number };

/** Puts work on the background queue. The web server only sends jobs; the worker runs them. */
export type JobQueue = {
  /** Queues AI classification of a new ticket. Resolves once the job is saved, not when it has run. */
  classifyTicket(ticketId: number): Promise<void>;
};

/** Starts pg-boss (creating its `pgboss` schema on first run) and makes sure every queue exists. */
export async function startBoss(connectionString: string) {
  const boss = new PgBoss(connectionString);
  boss.on('error', (error) => console.error('pg-boss error', error));
  await boss.start();
  await ensureQueue(boss, CLASSIFY_TICKET, {
    // 3 retries with increasing delays (about 5s, 10s, 20s), then the job is marked failed and the
    // ticket stays unclassified: agents can always set the category by hand.
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 120,
  });
  return boss;
}

export function createJobQueue(boss: PgBoss): JobQueue {
  return {
    async classifyTicket(ticketId) {
      const data: ClassifyTicketJob = { ticketId };
      // The singleton key stops a ticket from being queued twice while a job for it is waiting.
      await boss.send(CLASSIFY_TICKET, data, { singletonKey: String(ticketId) });
    },
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
