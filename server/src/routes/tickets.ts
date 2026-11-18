import { Router } from 'express';
import { listTicketsQuerySchema, type ListTicketsResponse } from '@helpdesk/shared';
import { requireAuth } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { listTickets } from '@/services/tickets.js';
import type { Services } from '@/types.js';

/** Tickets, available to every signed-in agent and admin. */
export function ticketsRouter({ db, auth }: Services) {
  const router = Router();
  router.use(requireAuth(auth));

  router.get('/', validate({ query: listTicketsQuerySchema }), async (req, res) => {
    const body: ListTicketsResponse = { tickets: await listTickets(db, req.query) };
    res.json(body);
  });

  return router;
}
