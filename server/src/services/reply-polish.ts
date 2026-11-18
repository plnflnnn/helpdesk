import type { LanguageModel } from 'ai';
import type { TicketDetail } from '@helpdesk/shared';
import type { Database } from '@/db.js';
import { formatConversation, generate, requireModel } from '@/services/ai.js';
import { getTicket } from '@/services/tickets.js';

const INSTRUCTIONS = `You are an editor for the customer support team of an online course platform.
You receive a support ticket conversation and an agent's draft reply to the customer.
Rewrite the draft into the body of a short, polished email.

Tone and style:
- Professional, warm and customer-friendly. Be empathetic where it fits, but not over the top.
- Concise: get straight to the point, at most 2-3 short paragraphs. Do not pad or repeat yourself.
- Correct spelling, grammar and punctuation.

Content:
- Keep the agent's meaning, facts, decisions, steps and links exactly as given. Never invent information, promises, policies or links.
- Write in the same language as the draft.

Format:
- Plain text only: no Markdown, no subject line, no placeholders like [Name].
- Separate paragraphs with a blank line. Put a sequence of steps on separate lines, numbered "1.", "2.", ...
- Write ONLY the body: no greeting (such as "Hi ...") and no sign-off or signature, even if the draft has them. They are added for you.
- Reply with the email body only, without any commentary.`;

type PolishReplyParams = {
  db: Database;
  model: LanguageModel | undefined;
  ticketId: number;
  agentName: string;
  draft: string;
};

/** Rewrites an agent's draft reply with an LLM, using the ticket conversation as context. */
export async function polishReply({
  db,
  model,
  ticketId,
  agentName,
  draft,
}: PolishReplyParams): Promise<string> {
  const configuredModel = requireModel(model);
  const ticket = await getTicket(db, ticketId);
  const body = await generate({
    model: configuredModel,
    instructions: INSTRUCTIONS,
    prompt: buildPrompt(ticket, agentName, draft),
    task: 'polish the reply',
  });
  return formatEmail({
    customerFirstName: firstName(ticket.student.name),
    agentFirstName: firstName(agentName),
    body,
  });
}

/** The first word of a person's name, or null when we don't know their name. */
function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] || null;
}

type FormatEmailParams = {
  customerFirstName: string | null;
  agentFirstName: string | null;
  body: string;
};

/** Wraps the polished body in a greeting and a signature, both using first names only. */
function formatEmail({ customerFirstName, agentFirstName, body }: FormatEmailParams) {
  const greeting = customerFirstName ? `Hi ${customerFirstName},` : 'Hi there,';
  const signature = agentFirstName ? `${agentFirstName} from HelpDesk Support` : 'HelpDesk Support';
  return `${greeting}\n\n${body}\n\nBest regards,\n${signature}`;
}

function buildPrompt(ticket: TicketDetail, agentName: string, draft: string) {
  const studentName = ticket.student.name ?? ticket.student.email;
  const conversation = formatConversation(ticket);

  return `Ticket subject: ${ticket.subject}
      Student: ${studentName}
      Agent writing the reply: ${agentName}
      <conversation>${conversation}</conversation>
      <draft>${draft}</draft>
    `;
}
