// Seed script, run with `npm run db:seed`.
// Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (and optional ADMIN_NAME).
// Safe to run repeatedly: an existing user with that email is promoted to an active admin,
// and their password is left unchanged.
//
// Outside production it also adds demo data: a few agents (password DEMO_AGENT_PASSWORD) and
// 100 tickets. Tickets are only added while there are none, so re-running doesn't duplicate them.

import { config } from 'dotenv';
import { z } from 'zod';
import {
  createUserInputSchema,
  passwordSchema,
  Role,
  TicketStatus,
  type TicketCategory,
} from '@helpdesk/shared';
import prisma from '@/db.js';
import { createUser } from '@/lib/create-user.js';
import { demoTickets } from './demo-tickets.js';
import { createRandom } from './random.js';

config({ quiet: true });

const seedEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  ADMIN_EMAIL: createUserInputSchema.shape.email,
  ADMIN_PASSWORD: passwordSchema,
  ADMIN_NAME: z.string().trim().min(1).default('Admin'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_AGENT_PASSWORD: passwordSchema.default('demo-agent-password'),
});

type SeedEnv = z.infer<typeof seedEnvSchema>;

function parseSeedEnv() {
  const result = seedEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid seed environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

async function main() {
  const env = parseSeedEnv();
  const db = prisma;

  try {
    const adminId = await seedAdmin(db, env);
    if (env.NODE_ENV !== 'production') {
      await seedDemoData(db, env, adminId);
    }
  } finally {
    await db.$disconnect();
  }
}

/** Creates the admin, or makes the existing user with that email an active admin. Returns its id. */
async function seedAdmin(db: typeof prisma, env: SeedEnv): Promise<string> {
  const existing = await db.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { role: Role.admin, active: true },
    });
    console.log(`Admin ${env.ADMIN_EMAIL} already exists; ensured role admin and active.`);
    return existing.id;
  }

  const admin = await createUser({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    role: Role.admin,
  });
  console.log(`Created admin ${env.ADMIN_EMAIL}.`);
  return admin.id;
}

const demoAgents = [
  { name: 'Sarah Chen', email: 'sarah.chen@helpdesk.test' },
  { name: 'Marcus Johnson', email: 'marcus.johnson@helpdesk.test' },
  { name: 'Priya Patel', email: 'priya.patel@helpdesk.test' },
  { name: 'Diego Alvarez', email: 'diego.alvarez@helpdesk.test' },
];

/** Demo agents (created if missing) and, while there are no tickets yet, the demo tickets. */
async function seedDemoData(db: typeof prisma, env: SeedEnv, adminId: string) {
  const agentIds: string[] = [];
  for (const agent of demoAgents) {
    const existing = await db.user.findUnique({ where: { email: agent.email } });
    const user =
      existing ??
      (await createUser({ ...agent, password: env.DEMO_AGENT_PASSWORD, role: Role.agent }));
    agentIds.push(user.id);
  }

  if ((await db.ticket.count()) > 0) {
    console.log('Tickets already exist; skipped demo tickets.');
    return;
  }

  const random = createRandom(42);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  // Agents handle most tickets; the admin picks up the occasional one.
  const assignees = [...agentIds, ...agentIds, adminId];
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  // Oldest first, so ticket numbers grow with the creation date. Spread over the last 45 days,
  // with more tickets in recent days.
  const tickets = demoTickets
    .map((ticket) => ({ ticket, ageHours: Math.floor(random() ** 2.2 * 45 * 24) }))
    .sort((a, b) => b.ageHours - a.ageHours);

  for (const { ticket, ageHours } of tickets) {
    const status = statusForAge(ageHours / 24, random(), ticket.category);
    const unassigned = status === TicketStatus.open && random() < 0.6;
    const createdAt = new Date(now - ageHours * hour - Math.floor(random() * hour));
    // Open tickets that nobody touched were last updated when they came in.
    const updatedAt =
      status === TicketStatus.open && unassigned
        ? createdAt
        : new Date(createdAt.getTime() + Math.floor(random() * ageHours * hour));

    await db.ticket.create({
      data: {
        subject: ticket.subject,
        status,
        category: ticket.category,
        priority: ticket.priority,
        createdAt,
        updatedAt,
        resolvedAt:
          status === TicketStatus.resolved || status === TicketStatus.closed ? updatedAt : null,
        student: {
          connectOrCreate: {
            where: { email: ticket.student.email },
            create: { ...ticket.student, createdAt },
          },
        },
        assignee: unassigned ? undefined : { connect: { id: pick(assignees) } },
        messages: {
          create: { direction: 'inbound', bodyText: ticket.body, createdAt },
        },
      },
    });
  }
  console.log(`Created ${demoAgents.length} demo agents and ${tickets.length} demo tickets.`);
}

/** New tickets are mostly open; older ones have mostly been answered, resolved or closed. */
function statusForAge(ageDays: number, roll: number, category: TicketCategory): TicketStatus {
  if (ageDays < 2) {
    return roll < 0.8 ? TicketStatus.open : TicketStatus.pending;
  }
  if (ageDays < 7) {
    if (roll < 0.35) return TicketStatus.open;
    if (roll < 0.75) return TicketStatus.pending;
    return TicketStatus.resolved;
  }
  // Closed is set 7 days after Resolved.
  if (ageDays < 14) {
    if (roll < 0.1) return TicketStatus.open;
    if (roll < 0.35) return TicketStatus.pending;
    return TicketStatus.resolved;
  }
  // Refunds sometimes drag on waiting for the bank.
  if (category === 'refund_request' && roll < 0.2) {
    return TicketStatus.pending;
  }
  return roll < 0.15 ? TicketStatus.resolved : TicketStatus.closed;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
