import type { Prisma } from '@generated/prisma/client.js';
import prisma from '@/db.js';

export const ticketListSelect = {
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

/** The ticket with its conversation, oldest message first. */
export function findTicket(id: number) {
  return prisma.ticket.findUnique({ where: { id }, select: ticketDetailSelect });
}

export type TicketWithMessages = NonNullable<Awaited<ReturnType<typeof findTicket>>>;
