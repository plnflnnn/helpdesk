import { Router } from 'express';
import { z } from 'zod';
import {
  createUserInputSchema,
  Role,
  updateUserInputSchema,
  type ListUsersResponse,
  type UpdateUserInput,
  type User,
  type UserResponse,
} from '@helpdesk/shared';
import { badRequest } from '@/errors.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { createUser, listUsers, updateUser } from '@/services/users.js';
import type { Services } from '@/types.js';

const userIdParamsSchema = z.object({ id: z.string().min(1) });

/** Admin-only user management: list, create and update users. */
export function usersRouter({ db, auth }: Services) {
  const router = Router();
  router.use(requireAuth(auth), requireRole(Role.admin));

  router.get('/', async (_req, res) => {
    const body: ListUsersResponse = { users: await listUsers(db) };
    res.json(body);
  });

  router.post('/', validate({ body: createUserInputSchema }), async (req, res) => {
    const body: UserResponse = { user: await createUser({ db, data: req.body }) };
    res.status(201).json(body);
  });

  router.patch(
    '/:id',
    validate({ params: userIdParamsSchema, body: updateUserInputSchema }),
    async (req, res) => {
      const userId = req.params.id;
      assertNotLockingSelfOut(req.user!, userId, req.body);

      const body: UserResponse = { user: await updateUser({ db, userId, data: req.body }) };
      res.json(body);
    },
  );

  return router;
}

/** Admins can't deactivate or demote themselves, so there is always an admin who can sign in. */
function assertNotLockingSelfOut(currentUser: User, userId: string, data: UpdateUserInput) {
  if (userId !== currentUser.id) {
    return;
  }
  if (data.active === false) {
    throw badRequest('You cannot deactivate your own account');
  }
  if (data.role !== undefined && data.role !== currentUser.role) {
    throw badRequest('You cannot change your own role');
  }
}
