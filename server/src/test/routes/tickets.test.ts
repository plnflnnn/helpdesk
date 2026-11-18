import { listTicketsResponseSchema, Role, type TicketListItem } from '@helpdesk/shared';
import { createTestContext } from '@/test/context.js';

const ctx = createTestContext();

beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

/** Three tickets with different values in every sortable column. */
async function seedTickets() {
  const agent = await ctx.db.user.update({
    where: { id: (await ctx.createUser()).id },
    data: { name: 'Zoe Zhang' },
  });
  const otherAgent = await ctx.db.user.update({
    where: { id: (await ctx.createUser()).id },
    data: { name: 'Ben Brown' },
  });
  const day = (n: number) => new Date(Date.UTC(2026, 10, n));

  const create = (data: {
    subject: string;
    status: 'open' | 'pending' | 'closed';
    category: 'refund_request' | 'technical_question' | 'general_question';
    priority: 'low' | 'normal' | 'high';
    student: { email: string; name: string | null };
    assigneeId: string | null;
    createdAt: Date;
    body: string;
  }) =>
    ctx.db.ticket.create({
      data: {
        subject: data.subject,
        status: data.status,
        category: data.category,
        priority: data.priority,
        assignee: data.assigneeId ? { connect: { id: data.assigneeId } } : undefined,
        createdAt: data.createdAt,
        updatedAt: data.createdAt,
        student: { create: data.student },
        messages: { create: { direction: 'inbound', bodyText: data.body } },
      },
    });

  await create({
    subject: 'Cannot log in',
    status: 'pending',
    category: 'technical_question',
    priority: 'high',
    student: { email: 'mia@example.com', name: 'Mia' },
    assigneeId: agent.id,
    createdAt: day(1),
    body: 'The password reset email never arrived.',
  });
  await create({
    subject: 'Refund please',
    status: 'closed',
    category: 'refund_request',
    priority: 'low',
    student: { email: 'aaron@example.com', name: 'Aaron' },
    assigneeId: otherAgent.id,
    createdAt: day(3),
    body: 'I was charged twice for the React course.',
  });
  await create({
    subject: 'Where is the certificate?',
    status: 'open',
    category: 'general_question',
    priority: 'normal',
    student: { email: 'nameless@example.com', name: null },
    assigneeId: null,
    createdAt: day(2),
    body: 'I finished the course a week ago.',
  });
}

async function listAs(query = '') {
  const agent = await ctx.createUser({ role: Role.agent });
  const client = await ctx.loginAs(agent.email);
  return client.get(`/api/tickets${query}`);
}

const subjects = (tickets: TicketListItem[]) => tickets.map((t) => t.subject);

describe('GET /api/tickets', () => {
  it('rejects unauthenticated requests with 401', async () => {
    expect((await ctx.client().get('/api/tickets')).status).toBe(401);
  });

  it('lists tickets newest first by default, with student and assignee', async () => {
    await seedTickets();

    const response = await listAs();

    expect(response.status).toBe(200);
    const { tickets } = listTicketsResponseSchema.parse(response.body);
    expect(subjects(tickets)).toEqual([
      'Refund please',
      'Where is the certificate?',
      'Cannot log in',
    ]);
    expect(tickets[0]).toMatchObject({
      status: 'closed',
      category: 'refund_request',
      priority: 'low',
      student: { email: 'aaron@example.com', name: 'Aaron' },
      assignee: { name: 'Ben Brown' },
    });
    expect(tickets[1]?.assignee).toBeNull();
  });

  it.each([
    ['subject', 'asc', ['Cannot log in', 'Refund please', 'Where is the certificate?']],
    ['createdAt', 'asc', ['Cannot log in', 'Where is the certificate?', 'Refund please']],
    // Enums sort in their natural order, not alphabetically.
    ['status', 'asc', ['Where is the certificate?', 'Cannot log in', 'Refund please']],
    ['category', 'asc', ['Where is the certificate?', 'Cannot log in', 'Refund please']],
    // Students without a name come last.
    ['student', 'asc', ['Refund please', 'Cannot log in', 'Where is the certificate?']],
  ])('sorts by %s %s', async (sortBy, sortOrder, expected) => {
    await seedTickets();

    const response = await listAs(`?sortBy=${sortBy}&sortOrder=${sortOrder}`);

    expect(response.status).toBe(200);
    expect(subjects(listTicketsResponseSchema.parse(response.body).tickets)).toEqual(expected);
  });

  it.each([
    ['status', '?status=open', ['Where is the certificate?']],
    ['category', '?category=refund_request', ['Refund please']],
    ['search in the subject', '?search=LOG%20IN', ['Cannot log in']],
    ['search in the message body', '?search=charged%20twice', ['Refund please']],
    ['search by sender email', '?search=nameless@', ['Where is the certificate?']],
    ['search by sender name', '?search=mia', ['Cannot log in']],
    [
      'an empty search',
      '?search=%20%20',
      ['Refund please', 'Where is the certificate?', 'Cannot log in'],
    ],
    [
      'combined filters',
      '?status=pending&category=technical_question&search=password',
      ['Cannot log in'],
    ],
    ['filters with no match', '?status=open&category=refund_request', []],
  ])('filters by %s', async (_case, query, expected) => {
    await seedTickets();

    const response = await listAs(query);

    expect(response.status).toBe(200);
    expect(subjects(listTicketsResponseSchema.parse(response.body).tickets)).toEqual(expected);
  });

  it.each([
    ['?sortBy=password'],
    ['?sortOrder=sideways'],
    ['?status=archived'],
    ['?category=spam'],
    [`?search=${'x'.repeat(201)}`],
  ])('rejects an invalid query %s with 400', async (query) => {
    const response = await listAs(query);

    expect(response.status).toBe(400);
  });
});
