import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Database } from '@/db.js';
import type { Env } from '@/env.js';
import { createAiModel } from '@/services/ai.js';
import type { Mailer } from '@/services/email.js';
import { autoResolveTicket, loadKnowledgeBase } from '@/services/ticket-auto-resolve.js';
import { classifyTicket } from '@/services/ticket-classification.js';

/** Runs one ticket job. The signal aborts when the job takes too long. */
export type TicketTask = (ticketId: number, signal: AbortSignal) => Promise<void>;

/** The ticket jobs this deployment can run. A missing task is skipped (no AI key or knowledge base). */
export type TicketHandlers = {
  classify?: TicketTask;
  autoResolve?: TicketTask;
};

type CreateTicketHandlersParams = {
  db: Database;
  mailer: Mailer;
  env: Env;
};

/**
 * Builds the ticket job handlers. Shared by the pg-boss workers (Render, local dev) and the inline
 * job queue (Vercel).
 */
export async function createTicketHandlers({
  db,
  mailer,
  env,
}: CreateTicketHandlersParams): Promise<TicketHandlers> {
  const model = createAiModel(env);
  if (!model) {
    console.warn('OPENAI_API_KEY is not set: tickets will not be classified or auto-resolved');
    return {};
  }

  const classify: TicketTask = async (ticketId, signal) => {
    await classifyTicket({ db, model, ticketId, signal });
  };

  // Relative to the server folder, whether running from src/jobs/ (tsx) or dist/src/jobs/ (build).
  const serverDir = fileURLToPath(
    new URL(import.meta.url.includes('/dist/') ? '../../..' : '../..', import.meta.url),
  );
  const knowledgeBase = await loadKnowledgeBase(path.resolve(serverDir, env.KNOWLEDGE_BASE_PATH));
  if (!knowledgeBase) {
    console.warn('No knowledge base: new tickets will not be auto-resolved');
    return { classify };
  }

  const autoResolve: TicketTask = async (ticketId, signal) => {
    const outcome = await autoResolveTicket({ db, model, mailer, knowledgeBase, ticketId, signal });
    console.log(`Auto-resolve ticket ${ticketId}: ${outcome}`);
  };

  return { classify, autoResolve };
}
