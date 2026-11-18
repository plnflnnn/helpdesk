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

// Ticket detail.

export const messageDirectionSchema = z.enum(['inbound', 'outbound']);
export type MessageDirection = z.infer<typeof messageDirectionSchema>;

/** One email in a ticket's conversation. `author` is the agent who sent an outbound message. */
export const ticketMessageSchema = z.object({
  id: z.string(),
  direction: messageDirectionSchema,
  author: z.object({ id: z.string(), name: z.string() }).nullable(),
  bodyText: z.string(),
  createdAt: z.iso.datetime(),
});
export type TicketMessage = z.infer<typeof ticketMessageSchema>;

/** A ticket with its whole conversation, oldest message first. */
export const ticketDetailSchema = ticketListItemSchema.extend({
  messages: z.array(ticketMessageSchema),
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

/** Response of `GET /api/tickets/:id` and `PATCH /api/tickets/:id`. */
export const ticketResponseSchema = z.object({ ticket: ticketDetailSchema });
export type TicketResponse = z.infer<typeof ticketResponseSchema>;

/** Largest ticket id (Postgres `integer`). */
const TICKET_ID_MAX = 2_147_483_647;

/** Route params of `/api/tickets/:id`. */
export const ticketIdParamsSchema = z.object({
  id: z.coerce.number().int().positive().max(TICKET_ID_MAX),
});

/**
 * Body of `PATCH /api/tickets/:id`: any subset of status, category and assignee.
 * `assigneeId: null` returns the ticket to the unassigned queue.
 */
export const updateTicketInputSchema = z
  .object({
    status: ticketStatusSchema,
    category: ticketCategorySchema,
    assigneeId: z.string().min(1).nullable(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;

// Assignees.

/** Someone a ticket can be assigned to: any active user (agents and admins). */
export const assigneeSchema = z.object({ id: z.string(), name: z.string() });
export type Assignee = z.infer<typeof assigneeSchema>;

export const listAssigneesResponseSchema = z.object({ assignees: z.array(assigneeSchema) });
export type ListAssigneesResponse = z.infer<typeof listAssigneesResponseSchema>;
