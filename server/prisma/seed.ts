// Seed script, run with `npm run db:seed`.
// Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (and optional ADMIN_NAME).
// Safe to run repeatedly: an existing user with that email is promoted to an active admin,
// and their password is left unchanged.

import { config } from 'dotenv';
import { z } from 'zod';
import { createUserInputSchema, passwordSchema, Role } from '@helpdesk/shared';
import { createPrismaClient } from '@/db.js';
import { createUser } from '@/services/users.js';

config({ quiet: true });

const seedEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  ADMIN_EMAIL: createUserInputSchema.shape.email,
  ADMIN_PASSWORD: passwordSchema,
  ADMIN_NAME: z.string().trim().min(1).default('Admin'),
});

function parseSeedEnv() {
  const result = seedEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid seed environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

async function main() {
  const env = parseSeedEnv();
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

    await createUser({
      db,
      data: {
        name: env.ADMIN_NAME,
        email: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD,
        role: Role.admin,
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
