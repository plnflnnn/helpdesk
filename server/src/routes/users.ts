import { Router } from 'express';
import {
  createAgentInputSchema,
  Role,
  updateUserInputSchema,
  type CreateAgentResponse,
  type ListUsersResponse,
} from '@helpdesk/shared';
import type { Auth } from '../auth.js';
import type { Database } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAgent, EmailTakenError, listUsers, setUserActive } from '../users.js';
import { validationError } from './validation.js';

export function usersRouter({ auth, db, appUrl }: { auth: Auth; db: Database; appUrl: string }) {
  const router = Router();
  router.use(requireAuth(auth), requireRole(Role.admin));

  router.get('/', async (_req, res) => {
    const body: ListUsersResponse = { users: await listUsers(db) };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const parsed = createAgentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    try {
      const { user, inviteToken } = await createAgent(db, parsed.data);
      const inviteUrl = new URL(`/set-password?token=${inviteToken}`, appUrl).toString();
      // Invite emails are sent through SendGrid from Phase 2; until then, log the link.
      console.log(`Invite for ${user.email}: ${inviteUrl}`);
      const body: CreateAgentResponse = { user, inviteUrl };
      res.status(201).json(body);
    } catch (error) {
      if (error instanceof EmailTakenError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  router.patch('/:id', async (req, res) => {
    const parsed = updateUserInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(validationError(parsed.error));
      return;
    }
    if (req.params.id === req.user?.id && !parsed.data.active) {
      res.status(400).json({ error: 'You cannot deactivate your own account' });
      return;
    }
    const user = await setUserActive(db, req.params.id, parsed.data.active);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  });

  return router;
}
