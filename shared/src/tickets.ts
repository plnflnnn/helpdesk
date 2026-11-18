import { z } from 'zod';

// Enums. Values mirror the Prisma enums and are listed in their natural order.

export const ticketStatusSchema = z.enum(['open', 'pending', 'resolved', 'closed']);
export const TicketStatus = ticketStatusSchema.enum;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketCategorySchema = z.enum([
  'general_question',
  'technical_question',
  'refund_request',
  'other',
]);
export const TicketCategory = ticketCategorySchema.enum;
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

export const ticketPrioritySchema = z.enum(['low', 'normal', 'high']);
export const TicketPriority = ticketPrioritySchema.enum;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketStatusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const ticketCategoryLabels: Record<TicketCategory, string> = {
  general_question: 'General Question',
  technical_question: 'Technical Question',
  refund_request: 'Refund Request',
  other: 'Other',
};

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

// Tickets.

export const ticketListItemSchema = z.object({
  id: z.number().int(),
  subject: z.string(),
  status: ticketStatusSchema,
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  student: z.object({ email: z.string(), name: z.string().nullable() }),
  assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TicketListItem = z.infer<typeof ticketListItemSchema>;

export const listTicketsResponseSchema = z.object({ tickets: z.array(ticketListItemSchema) });
export type ListTicketsResponse = z.infer<typeof listTicketsResponseSchema>;

// List query.

/** Columns the ticket list can be sorted by (`student` is the sender). */
export const ticketSortFieldSchema = z.enum([
  'subject',
  'student',
  'status',
  'category',
  'createdAt',
]);
export type TicketSortField = z.infer<typeof ticketSortFieldSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;

/** Longest search text accepted. */
export const TICKET_SEARCH_MAX_LENGTH = 200;

/**
 * Query string of `GET /api/tickets`. Newest tickets first by default.
 * `search` matches the subject, message bodies and the sender's name or email (case-insensitive);
 * an empty search is the same as none.
 */
export const listTicketsQuerySchema = z.object({
  sortBy: ticketSortFieldSchema.default('createdAt'),
  sortOrder: sortOrderSchema.default('desc'),
  search: z
    .string()
    .trim()
    .max(TICKET_SEARCH_MAX_LENGTH, `Search must be at most ${TICKET_SEARCH_MAX_LENGTH} characters`)
    .optional()
    .transform((search) => search || undefined),
  status: ticketStatusSchema.optional(),
  category: ticketCategorySchema.optional(),
});
/** What the client sends (every field optional). */
export type ListTicketsQueryInput = z.input<typeof listTicketsQuerySchema>;
/** What the server receives after parsing (defaults filled in). */
export type ListTicketsQuery = z.output<typeof listTicketsQuerySchema>;
