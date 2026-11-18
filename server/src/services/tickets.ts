import type {
  Assignee,
  ListTicketsQuery,
  TicketDetail,
  TicketListItem,
  TicketSortField,
  UpdateTicketInput,
} from '@helpdesk/shared';
import type { Prisma } from '@generated/prisma/client.js';
import type { Database } from '@/db.js';
import { badGateway, badRequest, notFound } from '@/errors.js';
import { newMessageId, ticketReplyAddress, type Mailer } from '@/services/email.js';

const TICKET_NOT_FOUND = 'Ticket not found';
const ASSIGNEE_NOT_FOUND = 'This agent does not exist or is inactive';

const ticketListSelect = {
  id: true,
  subject: true,
  status: true,
  category: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  student: { select: { email: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const satisfies Prisma.TicketSelect;

type TicketListRecord = Prisma.TicketGetPayload<{ select: typeof ticketListSelect }>;

function toTicketListItem(record: TicketListRecord): TicketListItem {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** The ORDER BY for a sortable column. Enum columns sort in their declared (natural) order. */
function orderByField(
  field: TicketSortField,
  order: Prisma.SortOrder,
): Prisma.TicketOrderByWithRelationInput {
  switch (field) {
    case 'student':
      return { student: { name: { sort: order, nulls: 'last' } } };
    default:
      return { [field]: order };
  }
}

/** Tickets matching every given filter. */
function whereFilters({ search, status, category }: ListTicketsQuery): Prisma.TicketWhereInput {
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
  return where;
}

/**
 * One page of the tickets matching the filters, sorted on the database (ties go to the newest
 * ticket), and how many tickets match in total.
 */
export async function listTickets(
  db: Database,
  query: ListTicketsQuery,
): Promise<{ tickets: TicketListItem[]; total: number }> {
  const { sortBy, sortOrder, page, pageSize } = query;
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [orderByField(sortBy, sortOrder)];
  if (sortBy === 'student') {
    // Students without a name are told apart by email.
    orderBy.push({ student: { email: sortOrder } });
  }
  orderBy.push({ id: 'desc' });

  const where = whereFilters(query);
  const [tickets, total] = await db.$transaction([
    db.ticket.findMany({
      where,
      select: ticketListSelect,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.ticket.count({ where }),
  ]);
  return { tickets: tickets.map(toTicketListItem), total };
}

const ticketDetailSelect = {
  ...ticketListSelect,
  messages: {
    select: {
      id: true,
      direction: true,
      bodyText: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} as const satisfies Prisma.TicketSelect;

type TicketDetailRecord = Prisma.TicketGetPayload<{ select: typeof ticketDetailSelect }>;

function toTicketDetail(record: TicketDetailRecord): TicketDetail {
  return {
    ...toTicketListItem(record),
    messages: record.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

/** The ticket with its conversation, or 404. */
export async function getTicket(db: Database, ticketId: number): Promise<TicketDetail> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: ticketDetailSelect,
  });
  if (!ticket) {
    throw notFound(TICKET_NOT_FOUND);
  }
  return toTicketDetail(ticket);
}

type UpdateTicketParams = {
  db: Database;
  ticketId: number;
  data: UpdateTicketInput;
};

/** Changes the ticket's status, category or assignee. Only active users can be assigned. */
export async function updateTicket({
  db,
  ticketId,
  data,
}: UpdateTicketParams): Promise<TicketDetail> {
  const { assigneeId, ...fields } = data;
  if (assigneeId) {
    await assertAssignable(db, assigneeId);
  }

  const { count } = await db.ticket.updateMany({
    where: { id: ticketId },
    data: { ...fields, assigneeId },
  });
  if (count === 0) {
    throw notFound(TICKET_NOT_FOUND);
  }
  return getTicket(db, ticketId);
}

type AddReplyParams = {
  db: Database;
  mailer: Mailer;
  ticketId: number;
  author: { id: string; name: string };
  bodyText: string;
};

/**
 * Emails an agent's reply to the student, threaded onto the conversation, then saves it on the
 * ticket and sets the ticket to pending (waiting on the student). Responds 502 and saves nothing
 * when the email can't be sent.
 */
export async function addReply({
  db,
  mailer,
  ticketId,
  author,
  bodyText,
}: AddReplyParams): Promise<TicketDetail> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      subject: true,
      student: { select: { email: true } },
      messages: {
        where: { emailMessageId: { not: null } },
        select: { emailMessageId: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!ticket) {
    throw notFound(TICKET_NOT_FOUND);
  }

  const emailMessageId = newMessageId(mailer.from);
  const references = ticket.messages.map((message) => message.emailMessageId!);
  const inReplyTo = references.at(-1);
  try {
    await mailer.send({
      to: ticket.student.email,
      subject: replySubject(ticket.subject),
      text: bodyText,
      fromName: author.name,
      replyTo: ticketReplyAddress(mailer.from, ticketId),
      headers: {
        'Message-ID': emailMessageId,
        ...(inReplyTo && { 'In-Reply-To': inReplyTo, References: references.join(' ') }),
      },
    });
  } catch (error) {
    console.error(`Sending the reply on ticket ${ticketId} failed`, error);
    throw badGateway('The reply could not be emailed to the student. Try again.');
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'pending',
      messages: {
        create: { direction: 'outbound', authorId: author.id, bodyText, emailMessageId, inReplyTo },
      },
    },
  });
  return getTicket(db, ticketId);
}

/** `Cannot log in` → `Re: Cannot log in`, without stacking `Re: Re:`. */
function replySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

/** Active users that aren't deleted, by name: everyone a ticket can be assigned to. */
export async function listAssignees(db: Database): Promise<Assignee[]> {
  return db.user.findMany({
    where: assignableWhere,
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

const assignableWhere = { active: true, deletedAt: null } as const satisfies Prisma.UserWhereInput;

async function assertAssignable(db: Database, userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, ...assignableWhere },
    select: { id: true },
  });
  if (!user) {
    throw badRequest(ASSIGNEE_NOT_FOUND);
  }
}
