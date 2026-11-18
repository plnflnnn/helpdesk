import { DASHBOARD_DAYS, dashboardResponseSchema, Role } from '@helpdesk/shared';
import { createTestContext } from '@/test/context.js';

const ctx = createTestContext();

beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type SeedTicket = {
  status?: 'open' | 'pending' | 'resolved' | 'closed';
  createdAt?: Date;
  resolvedAt?: Date | null;
  /** Who replied: 'ai' (no author), 'agent', or both. */
  replies?: ('ai' | 'agent')[];
};

let studentCount = 0;

async function createTicket(
  agentId: string,
  { status = 'open', createdAt = new Date(), resolvedAt = null, replies = [] }: SeedTicket = {},
) {
  return ctx.db.ticket.create({
    data: {
      subject: 'Question',
      status,
      createdAt,
      resolvedAt,
      student: { create: { email: `student${++studentCount}@example.com` } },
      messages: {
        create: [
          { direction: 'inbound', bodyText: 'Help', createdAt },
          ...replies.map((from) => ({
            direction: 'outbound' as const,
            bodyText: 'Answer',
            authorId: from === 'agent' ? agentId : null,
          })),
        ],
      },
    },
  });
}

async function getStats(query = '') {
  const agent = await ctx.createUser({ role: Role.agent });
  const client = await ctx.loginAs(agent.email);
  return client.get(`/api/dashboard${query}`);
}

describe('GET /api/dashboard', () => {
  it('rejects unauthenticated requests with 401', async () => {
    expect((await ctx.client().get('/api/dashboard')).status).toBe(401);
  });

  it('counts tickets, open tickets and tickets resolved by the AI', async () => {
    const agent = await ctx.createUser();
    const now = Date.now();
    await createTicket(agent.id, { status: 'open' });
    await createTicket(agent.id, { status: 'open' });
    await createTicket(agent.id, { status: 'pending', replies: ['agent'] });
    // Resolved by the AI: only AI replies.
    await createTicket(agent.id, {
      status: 'resolved',
      createdAt: new Date(now - 2 * HOUR),
      resolvedAt: new Date(now - HOUR),
      replies: ['ai'],
    });
    await createTicket(agent.id, {
      status: 'closed',
      createdAt: new Date(now - 4 * HOUR),
      resolvedAt: new Date(now - HOUR),
      replies: ['ai'],
    });
    // An agent also replied, so not the AI's work.
    await createTicket(agent.id, {
      status: 'resolved',
      createdAt: new Date(now - 6 * HOUR),
      resolvedAt: new Date(now - HOUR),
      replies: ['ai', 'agent'],
    });
    // AI replied, but the student wrote back and it is open again.
    await createTicket(agent.id, { status: 'open', replies: ['ai'] });

    const response = await getStats();

    expect(response.status).toBe(200);
    const { stats } = dashboardResponseSchema.parse(response.body);
    expect(stats).toMatchObject({ totalTickets: 7, openTickets: 3, resolvedByAi: 2 });
    // (1h + 3h + 5h) / 3
    expect(stats.averageResolutionSeconds).toBeCloseTo(3 * 3600, 0);
  });

  it('has no average resolution time when nothing was resolved', async () => {
    const agent = await ctx.createUser();
    await createTicket(agent.id);

    const { stats } = dashboardResponseSchema.parse((await getStats()).body);

    expect(stats.averageResolutionSeconds).toBeNull();
  });

  it('counts tickets per day for the last 30 days, including empty days', async () => {
    const agent = await ctx.createUser();
    const now = Date.now();
    await createTicket(agent.id, { createdAt: new Date(now) });
    await createTicket(agent.id, { createdAt: new Date(now) });
    await createTicket(agent.id, { createdAt: new Date(now - 3 * DAY) });
    // Too old for the chart.
    await createTicket(agent.id, { createdAt: new Date(now - 40 * DAY) });

    const { stats } = dashboardResponseSchema.parse((await getStats('?timeZone=UTC')).body);

    expect(stats.ticketsPerDay).toHaveLength(DASHBOARD_DAYS);
    const utcDate = (time: number) => new Date(time).toISOString().slice(0, 10);
    expect(stats.ticketsPerDay.at(-1)).toEqual({ date: utcDate(now), count: 2 });
    expect(stats.ticketsPerDay.at(-4)).toEqual({ date: utcDate(now - 3 * DAY), count: 1 });
    expect(stats.ticketsPerDay.at(0)?.date).toBe(utcDate(now - 29 * DAY));
    expect(stats.ticketsPerDay.reduce((sum, day) => sum + day.count, 0)).toBe(3);
  });

  it('groups days in the requested time zone', async () => {
    const agent = await ctx.createUser();
    // 23:30 UTC yesterday is already today in Tokyo (UTC+9).
    const today = new Date();
    const lateYesterdayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - 1,
      23,
      30,
    );
    await createTicket(agent.id, { createdAt: new Date(lateYesterdayUtc) });

    const { stats } = dashboardResponseSchema.parse((await getStats('?timeZone=Asia/Tokyo')).body);

    const tokyoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(
      lateYesterdayUtc,
    );
    expect(stats.ticketsPerDay.find((day) => day.date === tokyoDate)?.count).toBe(1);
  });

  it('rejects an unknown time zone with 400', async () => {
    expect((await getStats('?timeZone=Mars/Olympus')).status).toBe(400);
  });
});

describe('resolvedAt', () => {
  it('is set when an agent resolves a ticket, kept when it is closed, and cleared when reopened', async () => {
    const agent = await ctx.createUser();
    const client = await ctx.loginAs(agent.email);
    const ticket = await createTicket(agent.id);
    const resolvedAt = async () =>
      (await ctx.db.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).resolvedAt;

    await client.patch(`/api/tickets/${ticket.id}`).send({ status: 'resolved' });
    const firstResolved = await resolvedAt();
    expect(firstResolved).toBeInstanceOf(Date);

    await client.patch(`/api/tickets/${ticket.id}`).send({ status: 'closed' });
    expect(await resolvedAt()).toEqual(firstResolved);

    await client.patch(`/api/tickets/${ticket.id}`).send({ status: 'open' });
    expect(await resolvedAt()).toBeNull();
  });
});
