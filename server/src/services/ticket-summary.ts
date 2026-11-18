import type { LanguageModel } from 'ai';
import type { Database } from '@/db.js';
import { formatConversation, generate, requireModel } from '@/services/ai.js';
import { getTicket } from '@/services/tickets.js';

const INSTRUCTIONS = `You help customer support agents of an online course platform get up to speed on a ticket quickly.
You receive a support ticket and its full conversation between the student and the support agents.
Summarize it for an agent who is about to work on the ticket.

Write:
- One or two sentences on what the student needs and why.
- Then up to 4 short bullet points (starting with "- ") covering what has been done or said so far, and what is still open or the next step.

Rules:
- Be concise and factual; use only information in the conversation. Never guess or invent details.
- Mention concrete details that matter (order numbers, course names, dates, error messages).
- Write in English, in plain text: no Markdown other than the "- " bullets, no headings, no commentary.`;

type SummarizeTicketParams = {
  db: Database;
  model: LanguageModel | undefined;
  ticketId: number;
};

/** A short AI summary of the ticket and its conversation history. Nothing is saved. */
export async function summarizeTicket({ db, model, ticketId }: SummarizeTicketParams) {
  const configuredModel = requireModel(model);
  const ticket = await getTicket(db, ticketId);
  const studentName = ticket.student.name ?? ticket.student.email;
  return generate({
    model: configuredModel,
    instructions: INSTRUCTIONS,
    prompt: `Ticket subject: ${ticket.subject}
Status: ${ticket.status}
Student: ${studentName}

<conversation>
${formatConversation(ticket)}
</conversation>`,
    task: 'summarize the ticket',
  });
}
