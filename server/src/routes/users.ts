import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import { createUserInputSchema, Role, updateUserInputSchema } from '@helpdesk/shared';
import prisma from '@/db.js';
import { createUser, userSelect } from '@/lib/create-user.js';
import { validate } from '@/lib/validate.js';
import { requireAdmin } from '@/middleware/require-admin.js';
import { requireAuth } from '@/middleware/require-auth.js';

const userIdSchema = z.string().min(1);

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: userSelect,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  res.json({ users });
});

router.post('/', async (req, res) => {
  const data = validate(createUserInputSchema, req.body, res);
  if (!data) return;

  if (await isEmailTaken(data.email)) {
    res.status(409).json({ error: 'A user with this email already exists' });
    return;
  }

  res.status(201).json({ user: await createUser(data) });
});

/** A new password or deactivation signs the user out; deactivation also unassigns their tickets. */
router.patch('/:id', async (req, res) => {
  const id = validate(userIdSchema, req.params.id, res);
  if (!id) return;
  const data = validate(updateUserInputSchema, req.body, res);
  if (!data) return;

  // So there is always an admin who can sign in.
  if (id === req.user.id && data.active === false) {
    res.status(400).json({ error: 'You cannot deactivate your own account' });
    return;
  }
  if (id === req.user.id && data.role !== undefined && data.role !== req.user.role) {
    res.status(400).json({ error: 'You cannot change your own role' });
    return;
  }

  if (!(await prisma.user.findFirst({ where: { id, deletedAt: null } }))) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (data.email && (await isEmailTaken(data.email, id))) {
    res.status(409).json({ error: 'A user with this email already exists' });
    return;
  }

  const { password, ...fields } = data;
  const passwordHash = password ? await hashPassword(password) : undefined;
  const deactivate = data.active === false;

  const user = await prisma.$transaction(async (tx) => {
    if (passwordHash) {
      await tx.account.updateMany({ where: { userId: id }, data: { password: passwordHash } });
    }
    if (passwordHash || deactivate) {
      await tx.session.deleteMany({ where: { userId: id } });
    }
    if (deactivate) {
      await tx.ticket.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
    }
    return tx.user.update({ where: { id }, data: fields, select: userSelect });
  });
  res.json({ user });
});

/**
 * Soft-deletes an agent: they can't sign in, their sessions end and their tickets are unassigned.
 * The row stays, so their messages keep their author.
 */
router.delete('/:id', async (req, res) => {
  const id = validate(userIdSchema, req.params.id, res);
  if (!id) return;

  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (user.role === Role.admin) {
    res.status(403).json({ error: 'Admins cannot be deleted' });
    return;
  }

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.ticket.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } }),
    prisma.user.update({ where: { id }, data: { deletedAt: new Date(), active: false } }),
  ]);
  res.status(204).end();
});

async function isEmailTaken(email: string, exceptUserId?: string) {
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return owner !== null && owner.id !== exceptUserId;
}

export default router;
