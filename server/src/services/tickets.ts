import type { ListTicketsQuery, TicketListItem, TicketSortField } from '@helpdesk/shared';
import type { Prisma } from '@generated/prisma/client.js';
import type { Database } from '@/db.js';

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

/** Tickets matching the filters, sorted on the database. Ties go to the newest ticket. */
export async function listTickets(
  db: Database,
  query: ListTicketsQuery,
): Promise<TicketListItem[]> {
  const { sortBy, sortOrder } = query;
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [orderByField(sortBy, sortOrder)];
  if (sortBy === 'student') {
    // Students without a name are told apart by email.
    orderBy.push({ student: { email: sortOrder } });
  }
  orderBy.push({ id: 'desc' });

  const tickets = await db.ticket.findMany({
    where: whereFilters(query),
    select: ticketListSelect,
    orderBy,
  });
  return tickets.map(toTicketListItem);
}
