// Demo replies, run with `npm run db:seed:replies` (after `npm run db:seed`).
// Turns each resolved ticket into a short conversation: the student's original email, then
// replies alternating between the agent and the student, ending with the agent's reply that
// resolved it.
// Only tickets that still have just the original email get replies, so re-running is safe.
// Doesn't run in production.

import { config } from 'dotenv';
import { z } from 'zod';
import { TicketStatus, type TicketCategory } from '@helpdesk/shared';
import { createPrismaClient, type Database } from '@/db.js';
import { createRandom } from './random.js';

config({ quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

/** Who writes a reply. The conversation always starts and ends with the agent. */
type Turn = { from: 'agent' | 'student'; text: (names: Names) => string };
/** `student` and `agentFirstName` are used in greetings; `agent` is the full name for signatures. */
type Names = { student: string; agent: string; agentFirstName: string };

const agent = (text: Turn['text']): Turn => ({ from: 'agent', text });
const student = (text: Turn['text']): Turn => ({ from: 'student', text });

/**
 * Five replies per category: agent, student, agent, student, agent. A ticket gets the first 1, 3
 * or 5 of them, so every conversation alternates and ends with an agent reply that resolves it.
 */
const conversations: Record<TicketCategory, Turn[]> = {
  technical_question: [
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nThanks for reaching out, and sorry for the trouble. I’ve looked into your account and fixed the issue on our side. Could you try again now and let me know if it works?\n\nBest,\n${agent}`,
    ),
    student(
      ({ agentFirstName }) =>
        `Hi ${agentFirstName},\n\nThanks for the quick reply! It’s better now, but I still see the problem once in a while. Is there anything I should do on my end?`,
    ),
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nThat’s usually old data cached by the browser. Please clear your cache and cookies for our site (or try a private window) and sign in again. That should take care of it for good.\n\nBest,\n${agent}`,
    ),
    student(
      () => `That did it — everything works perfectly now. Thanks so much for your patience!`,
    ),
    agent(
      ({ student, agent }) =>
        `Great to hear, ${student}! I’ll mark this ticket as resolved. If anything comes up again, just reply to this email.\n\nHappy learning,\n${agent}`,
    ),
  ],
  refund_request: [
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nThanks for getting in touch. I’ve checked your order, and it’s eligible for a refund under our 30-day guarantee. I’ve started the refund to your original payment method; it usually shows up within 5–10 business days.\n\nBest,\n${agent}`,
    ),
    student(
      () =>
        `Thank you! Will I still have access to the course until then, and do I need to do anything else?`,
    ),
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nNo further action is needed. Course access ends once the refund is processed. You’ll get a confirmation email from our payment provider when it goes through.\n\nBest,\n${agent}`,
    ),
    student(
      () => `Just got the confirmation email and I can see the refund. Thanks for your help!`,
    ),
    agent(
      ({ student, agent }) =>
        `You’re welcome, ${student}! I’ll close this ticket now. We hope to see you back on the platform someday.\n\nAll the best,\n${agent}`,
    ),
  ],
  general_question: [
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nGreat question! You’ll find this under Account → Settings. I’ve also linked our help article on it here: https://help.example.com/getting-started\n\nBest,\n${agent}`,
    ),
    student(
      () =>
        `Thanks! I found the settings page, but I’m not sure which option I need. Could you point me to the right one?`,
    ),
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nOf course — it’s the second section on that page. Change the option there and click Save at the bottom. The change applies straight away.\n\nBest,\n${agent}`,
    ),
    student(() => `Got it, that worked. Really appreciate the step-by-step help!`),
    agent(
      ({ student, agent }) =>
        `Anytime, ${student}! I’ll mark this as resolved. Feel free to write in if you have more questions.\n\nCheers,\n${agent}`,
    ),
  ],
  other: [
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nThanks for your message. I’ve passed this on to the right team and they’ve taken care of it. Let me know if there’s anything else you need.\n\nBest,\n${agent}`,
    ),
    student(
      () => `Thanks for following up. Could you let me know roughly when I’ll see the change?`,
    ),
    agent(
      ({ student, agent }) =>
        `Hi ${student},\n\nThe change is already live — you might need to refresh the page or sign out and back in to see it.\n\nBest,\n${agent}`,
    ),
    student(() => `I can see it now. Thanks again for sorting this out!`),
    agent(
      ({ student, agent }) =>
        `Glad we could help, ${student}! I’m closing this ticket as resolved. Have a great day.\n\nBest,\n${agent}`,
    ),
  ],
};

/** How many replies a ticket gets. Always odd, so the agent has the last word. */
const replyCounts = [1, 3, 3, 5] as const;

async function main() {
  const env = envSchema.parse(process.env);
  if (env.NODE_ENV === 'production') {
    console.log('Skipped demo replies in production.');
    return;
  }

  const db = createPrismaClient(env.DATABASE_URL);
  try {
    await seedReplies(db);
  } finally {
    await db.$disconnect();
  }
}

async function seedReplies(db: Database) {
  const random = createRandom(7);

  // Fallback author for a resolved ticket that has no assignee.
  const anyAgent = await db.user.findFirst({
    where: { active: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (!anyAgent) {
    throw new Error('No active users to write replies. Run `npm run db:seed` first.');
  }

  const tickets = await db.ticket.findMany({
    where: { status: TicketStatus.resolved },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { name: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });

  let ticketCount = 0;
  let replyCount = 0;
  for (const ticket of tickets) {
    // Only tickets that still have just the student's original email.
    if (ticket._count.messages !== 1) {
      continue;
    }

    const author = ticket.assignee ?? anyAgent;
    const names: Names = {
      student: ticket.student.name?.split(' ')[0] ?? 'there',
      agent: author.name,
      agentFirstName: author.name.split(' ')[0]!,
    };
    const count = replyCounts[Math.floor(random() * replyCounts.length)]!;
    const turns = conversations[ticket.category].slice(0, count);

    // Spread the replies between the ticket's creation and its last update (when it was resolved).
    const start = ticket.createdAt.getTime();
    const span = ticket.updatedAt.getTime() - start;
    const replies = turns.map((turn, index) => ({
      ticketId: ticket.id,
      direction: turn.from === 'agent' ? ('outbound' as const) : ('inbound' as const),
      authorId: turn.from === 'agent' ? author.id : null,
      bodyText: turn.text(names),
      createdAt: new Date(start + (span * (index + 1)) / turns.length),
    }));

    await db.message.createMany({ data: replies });
    ticketCount += 1;
    replyCount += replies.length;
  }

  console.log(`Added ${replyCount} replies to ${ticketCount} resolved tickets.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
