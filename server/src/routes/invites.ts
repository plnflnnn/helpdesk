import { Router } from 'express';
import { acceptInviteInputSchema, type InviteDetails } from '@helpdesk/shared';
import type { Database } from '../db.js';
import { acceptInvite, getInviteDetails } from '../users.js';
import { validationError } from './validation.js';

const INVALID_INVITE = 'This invite link is invalid or has expired. Ask an admin for a new one.';

/** Public endpoints reached from the invite link: look up an invite and set a password with it. */
export function invitesRouter({ db }: { db: Database }) {
  const router = Router();

  router.get('/:token', async (req, res) => {
    const details = await getInviteDetails(db, req.params.token);
    if (!details) {
      res.status(404).json({ error: INVALID_INVITE });
      return;
    }
    const body: InviteDetails = details;
    res.json(body);
  });

  router.post('/:token/accept', async (req, res) => {
    const parsed = acceptInviteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    const accepted = await acceptInvite(db, req.params.token, parsed.data.password);
    if (!accepted) {
      res.status(404).json({ error: INVALID_INVITE });
      return;
    }
    res.status(204).end();
  });

  return router;
}
