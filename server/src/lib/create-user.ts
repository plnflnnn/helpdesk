import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { Role } from '@helpdesk/shared';
import prisma from '@/db.js';

/** The user columns the API returns. */
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

type NewUser = { name: string; email: string; password: string; role: Role };

/** Creates a user with an email/password account, so they can sign in right away. */
export async function createUser({ name, email, password, role }: NewUser) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      name,
      email,
      role,
      accounts: {
        create: { id: randomUUID(), accountId: id, password: await hashPassword(password) },
      },
    },
    select: userSelect,
  });
}
