import { Router } from 'express';
import { replyInputSchema } from '@helpdesk/shared';
import prisma from '@/db.js';
import { askAi, formatConversation } from '@/lib/ai.js';
import { emailReply, type SentReply } from '@/lib/email-reply.js';
import { parseId } from '@/lib/parse-id.js';
import { findTicket } from '@/lib/tickets.js';
import { validate } from '@/lib/validate.js';
import { requireAuth } from '@/middleware/require-auth.js';

const POLISH_INSTRUCTIONS = `You are an editor for the customer support team of an online course platform.
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

/** `ticketId` comes from the mount path, /api/tickets/:ticketId/replies. */
type TicketParams = { ticketId: string };

const router = Router({ mergeParams: true });
router.use(requireAuth);

/**
 * Emails the agent's reply to the student, then saves it and sets the ticket to pending (waiting
 * on the student). Responds 502 and saves nothing when the email can't be sent.
 */
router.post<'/', TicketParams>('/', async (req, res) => {
  const ticketId = parseId(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }
  const data = validate(replyInputSchema, req.body, res);
  if (!data) return;

  let sent: SentReply | null;
  try {
    sent = await emailReply(ticketId, req.user.name, data.bodyText);
  } catch (error) {
    console.error(`Sending the reply on ticket ${ticketId} failed`, error);
    res.status(502).json({ error: 'The reply could not be emailed to the student. Try again.' });
    return;
  }
  if (!sent) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'pending',
      resolvedAt: null,
      messages: {
        create: { direction: 'outbound', authorId: req.user.id, bodyText: data.bodyText, ...sent },
      },
    },
  });
  res.status(201).json({ ticket: await findTicket(ticketId) });
});

/** An improved version of the agent's draft, with a greeting and signature. Nothing is saved. */
router.post<'/polish', TicketParams>('/polish', async (req, res) => {
  const ticketId = parseId(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }
  const data = validate(replyInputSchema, req.body, res);
  if (!data) return;

  const ticket = await findTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const agentName = req.user.name;
  const body = await askAi(res, {
    instructions: POLISH_INSTRUCTIONS,
    prompt: `Ticket subject: ${ticket.subject}
Student: ${ticket.student.name ?? ticket.student.email}
Agent writing the reply: ${agentName}
<conversation>${formatConversation(ticket)}</conversation>
<draft>${data.bodyText}</draft>`,
    task: 'polish the reply',
  });
  if (body === null) return;

  const customer = firstName(ticket.student.name);
  const agent = firstName(agentName);
  const greeting = customer ? `Hi ${customer},` : 'Hi there,';
  const signature = agent ? `${agent} from HelpDesk Support` : 'HelpDesk Support';
  res.json({ bodyText: `${greeting}\n\n${body}\n\nBest regards,\n${signature}` });
});

function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] || null;
}

export default router;
