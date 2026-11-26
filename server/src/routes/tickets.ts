import { Router } from 'express';
import { listTicketsQuerySchema, updateTicketInputSchema } from '@helpdesk/shared';
import type { Prisma } from '@generated/prisma/client.js';
import prisma from '@/db.js';
import { askAi, formatConversation } from '@/lib/ai.js';
import { parseId } from '@/lib/parse-id.js';
import { findTicket, ticketListSelect } from '@/lib/tickets.js';
import { validate } from '@/lib/validate.js';
import { requireAuth } from '@/middleware/require-auth.js';

const SUMMARY_INSTRUCTIONS = `You help customer support agents of an online course platform get up to speed on a ticket quickly.
You receive a support ticket and its full conversation between the student and the support agents.
Summarize it for an agent who is about to work on the ticket.

Write:
- One or two sentences on what the student needs and why.
- Then up to 4 short bullet points (starting with "- ") covering what has been done or said so far, and what is still open or the next step.

Rules:
- Be concise and factual; use only information in the conversation. Never guess or invent details.
- Mention concrete details that matter (order numbers, course names, dates, error messages).
- Write in English, in plain text: no Markdown other than the "- " bullets, no headings, no commentary.`;

/** Active, not deleted: everyone a ticket can be assigned to. */
const assignable = { active: true, deletedAt: null } as const satisfies Prisma.UserWhereInput;

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const query = validate(listTicketsQuerySchema, req.query, res);
  if (!query) return;

  const { search, status, category, sortBy, sortOrder, page, pageSize } = query;
  const where: Prisma.TicketWhereInput = { status, category };
  if (search) {
    const contains = { contains: search, mode: 'insensitive' } as const;
    where.OR = [
      { subject: contains },
      { student: { email: contains } },
      { student: { name: contains } },
      { messages: { some: { bodyText: contains } } },
    ];
  }

  // Ties go to the newest ticket; students without a name are told apart by email.
  const orderBy: Prisma.TicketOrderByWithRelationInput[] =
    sortBy === 'student'
      ? [
          { student: { name: { sort: sortOrder, nulls: 'last' } } },
          { student: { email: sortOrder } },
        ]
      : [{ [sortBy]: sortOrder }];
  orderBy.push({ id: 'desc' });

  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      select: ticketListSelect,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);
  res.json({ tickets, total });
});

// Before `/:id`, so "assignees" isn't read as a ticket id.
router.get('/assignees', async (_req, res) => {
  const assignees = await prisma.user.findMany({
    where: assignable,
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  res.json({ assignees });
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  const ticket = await findTicket(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json({ ticket });
});

router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }
  const data = validate(updateTicketInputSchema, req.body, res);
  if (!data) return;

  if (data.assigneeId) {
    const assignee = await prisma.user.findFirst({ where: { id: data.assigneeId, ...assignable } });
    if (!assignee) {
      res.status(400).json({ error: 'This agent does not exist or is inactive' });
      return;
    }
  }

  // Resolving records when (closing keeps the first time); reopening clears it.
  const reopened = data.status === 'open' || data.status === 'pending';
  const resolved = data.status === 'resolved' || data.status === 'closed';
  const [{ count }] = await prisma.$transaction([
    prisma.ticket.updateMany({
      where: { id },
      data: { ...data, ...(reopened && { resolvedAt: null }) },
    }),
    ...(resolved
      ? [
          prisma.ticket.updateMany({
            where: { id, resolvedAt: null },
            data: { resolvedAt: new Date() },
          }),
        ]
      : []),
  ]);
  if (count === 0) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json({ ticket: await findTicket(id) });
});

// A POST because each call runs the AI and may give a different summary. Nothing is saved.
router.post('/:id/summary', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  const ticket = await findTicket(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const summary = await askAi(res, {
    instructions: SUMMARY_INSTRUCTIONS,
    prompt: `Ticket subject: ${ticket.subject}
Status: ${ticket.status}
Student: ${ticket.student.name ?? ticket.student.email}

<conversation>
${formatConversation(ticket)}
</conversation>`,
    task: 'summarize the ticket',
  });
  if (summary === null) return;

  res.json({ summary });
});

export default router;
