import { Router } from 'express';
import {
  listTicketsQuerySchema,
  replyInputSchema,
  ticketIdParamsSchema,
  updateTicketInputSchema,
  type ListAssigneesResponse,
  type ListTicketsResponse,
  type TicketResponse,
} from '@helpdesk/shared';
import { requireAuth } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import {
  addReply,
  getTicket,
  listAssignees,
  listTickets,
  updateTicket,
} from '@/services/tickets.js';
import type { Services } from '@/types.js';

/** Tickets, available to every signed-in agent and admin. */
export function ticketsRouter({ db, auth }: Services) {
  const router = Router();
  router.use(requireAuth(auth));

  router.get('/', validate({ query: listTicketsQuerySchema }), async (req, res) => {
    const body: ListTicketsResponse = await listTickets(db, req.query);
    res.json(body);
  });

  // Registered before `/:id` so "assignees" isn't read as a ticket id.
  router.get('/assignees', async (_req, res) => {
    const body: ListAssigneesResponse = { assignees: await listAssignees(db) };
    res.json(body);
  });

  router.get('/:id', validate({ params: ticketIdParamsSchema }), async (req, res) => {
    const body: TicketResponse = { ticket: await getTicket(db, req.params.id) };
    res.json(body);
  });

  router.patch(
    '/:id',
    validate({ params: ticketIdParamsSchema, body: updateTicketInputSchema }),
    async (req, res) => {
      const ticket = await updateTicket({ db, ticketId: req.params.id, data: req.body });
      const body: TicketResponse = { ticket };
      res.json(body);
    },
  );

  router.post(
    '/:id/replies',
    validate({ params: ticketIdParamsSchema, body: replyInputSchema }),
    async (req, res) => {
      const ticket = await addReply({
        db,
        ticketId: req.params.id,
        authorId: req.user!.id,
        bodyText: req.body.bodyText,
      });
      const body: TicketResponse = { ticket };
      res.status(201).json(body);
    },
  );

  return router;
}
