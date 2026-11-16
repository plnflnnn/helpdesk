// Seed script, run with `npm run db:seed`.
// Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (and optional ADMIN_NAME).
// Safe to run repeatedly: an existing user with that email is promoted to an active admin,
// and their password is left unchanged.

import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, Role } from '@helpdesk/shared';
import { createPrismaClient } from '../src/db.js';
import { CREDENTIAL_PROVIDER } from '../src/users.js';

config({ quiet: true });

const seedEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  ADMIN_EMAIL: z
    .email()
    .trim()
    .transform((email) => email.toLowerCase()),
  ADMIN_PASSWORD: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  ADMIN_NAME: z.string().trim().min(1).default('Admin'),
});

async function main() {
  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid seed environment variables:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  const db = createPrismaClient(env.DATABASE_URL);

  try {
    const existing = await db.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: { role: Role.admin, active: true },
      });
      console.log(`Admin ${env.ADMIN_EMAIL} already exists; ensured role admin and active.`);
      return;
    }

    const userId = randomUUID();
    await db.user.create({
      data: {
        id: userId,
        name: env.ADMIN_NAME,
        email: env.ADMIN_EMAIL,
        emailVerified: true,
        role: Role.admin,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: CREDENTIAL_PROVIDER,
            password: await hashPassword(env.ADMIN_PASSWORD),
          },
        },
      },
    });
    console.log(`Created admin ${env.ADMIN_EMAIL}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
