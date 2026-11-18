import {
  listAssigneesResponseSchema,
  listTicketsResponseSchema,
  Role,
  ticketResponseSchema,
  type TicketListItem,
} from '@helpdesk/shared';
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

  it('returns one page at a time, with the total number of matching tickets', async () => {
    await seedTickets();

    const first = listTicketsResponseSchema.parse((await listAs('?pageSize=2')).body);
    const second = listTicketsResponseSchema.parse((await listAs('?pageSize=2&page=2')).body);
    const beyond = listTicketsResponseSchema.parse((await listAs('?pageSize=2&page=3')).body);

    expect(first).toMatchObject({ total: 3 });
    expect(subjects(first.tickets)).toEqual(['Refund please', 'Where is the certificate?']);
    expect(second).toMatchObject({ total: 3 });
    expect(subjects(second.tickets)).toEqual(['Cannot log in']);
    expect(beyond).toEqual({ tickets: [], total: 3 });
  });

  it('counts only the tickets that match the filters', async () => {
    await seedTickets();

    const response = await listAs('?status=open&pageSize=1');

    expect(listTicketsResponseSchema.parse(response.body)).toMatchObject({ total: 1 });
  });

  it.each([
    ['?page=0'],
    ['?page=abc'],
    ['?pageSize=0'],
    ['?pageSize=101'],
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

/** A ticket with a student message followed by an agent reply. */
async function seedConversation() {
  const agent = await ctx.createUser();
  const ticket = await ctx.db.ticket.create({
    data: {
      subject: 'Cannot log in',
      category: 'technical_question',
      student: { create: { email: 'mia@example.com', name: 'Mia' } },
      messages: {
        create: [
          {
            direction: 'inbound',
            bodyText: 'The password reset email never arrived.',
            createdAt: new Date(Date.UTC(2026, 10, 1)),
          },
          {
            direction: 'outbound',
            bodyText: 'I have sent it again.',
            authorId: agent.id,
            createdAt: new Date(Date.UTC(2026, 10, 2)),
          },
        ],
      },
    },
  });
  return { ticket, agent };
}

async function signedInAgent() {
  const user = await ctx.createUser({ role: Role.agent });
  return ctx.loginAs(user.email);
}

describe('GET /api/tickets/:id', () => {
  it('rejects unauthenticated requests with 401', async () => {
    expect((await ctx.client().get('/api/tickets/1')).status).toBe(401);
  });

  it('returns the ticket with its conversation, oldest message first', async () => {
    const { ticket, agent } = await seedConversation();
    const client = await signedInAgent();

    const response = await client.get(`/api/tickets/${ticket.id}`);

    expect(response.status).toBe(200);
    const body = ticketResponseSchema.parse(response.body);
    expect(body.ticket).toMatchObject({
      id: ticket.id,
      subject: 'Cannot log in',
      status: 'open',
      category: 'technical_question',
      student: { email: 'mia@example.com', name: 'Mia' },
      assignee: null,
    });
    expect(body.ticket.messages).toMatchObject([
      { direction: 'inbound', author: null, bodyText: 'The password reset email never arrived.' },
      {
        direction: 'outbound',
        author: { id: agent.id, name: agent.name },
        bodyText: 'I have sent it again.',
      },
    ]);
  });

  it('responds 404 for a ticket that does not exist', async () => {
    const client = await signedInAgent();

    expect((await client.get('/api/tickets/999')).status).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('rejects the id %s with 400', async (id) => {
    const client = await signedInAgent();

    expect((await client.get(`/api/tickets/${id}`)).status).toBe(400);
  });
});

describe('PATCH /api/tickets/:id', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await ctx.client().patch('/api/tickets/1').send({ status: 'closed' });

    expect(response.status).toBe(401);
  });

  it('updates the status and category', async () => {
    const { ticket } = await seedConversation();
    const client = await signedInAgent();

    const response = await client
      .patch(`/api/tickets/${ticket.id}`)
      .send({ status: 'resolved', category: 'refund_request' });

    expect(response.status).toBe(200);
    expect(ticketResponseSchema.parse(response.body).ticket).toMatchObject({
      status: 'resolved',
      category: 'refund_request',
    });
    expect(await ctx.db.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({
      status: 'resolved',
      category: 'refund_request',
    });
  });

  it('assigns the ticket to an agent and unassigns it', async () => {
    const { ticket, agent } = await seedConversation();
    const client = await signedInAgent();

    const assigned = await client.patch(`/api/tickets/${ticket.id}`).send({ assigneeId: agent.id });

    expect(assigned.status).toBe(200);
    expect(ticketResponseSchema.parse(assigned.body).ticket.assignee).toEqual({
      id: agent.id,
      name: agent.name,
    });

    const unassigned = await client.patch(`/api/tickets/${ticket.id}`).send({ assigneeId: null });

    expect(unassigned.status).toBe(200);
    expect(ticketResponseSchema.parse(unassigned.body).ticket.assignee).toBeNull();
  });

  it('leaves fields that are not sent unchanged', async () => {
    const { ticket, agent } = await seedConversation();
    await ctx.db.ticket.update({ where: { id: ticket.id }, data: { assigneeId: agent.id } });
    const client = await signedInAgent();

    const response = await client.patch(`/api/tickets/${ticket.id}`).send({ status: 'pending' });

    expect(ticketResponseSchema.parse(response.body).ticket).toMatchObject({
      status: 'pending',
      category: 'technical_question',
      assignee: { id: agent.id },
    });
  });

  it.each([
    ['an inactive user', { active: false }],
    ['a deleted user', { deletedAt: new Date() }],
  ])('refuses to assign %s', async (_case, data) => {
    const { ticket } = await seedConversation();
    const other = await ctx.createUser();
    await ctx.db.user.update({ where: { id: other.id }, data });
    const client = await signedInAgent();

    const response = await client.patch(`/api/tickets/${ticket.id}`).send({ assigneeId: other.id });

    expect(response.status).toBe(400);
    expect((await ctx.db.ticket.findUnique({ where: { id: ticket.id } }))?.assigneeId).toBeNull();
  });

  it('refuses to assign a user that does not exist', async () => {
    const { ticket } = await seedConversation();
    const client = await signedInAgent();

    const response = await client.patch(`/api/tickets/${ticket.id}`).send({ assigneeId: 'nobody' });

    expect(response.status).toBe(400);
  });

  it('responds 404 for a ticket that does not exist', async () => {
    const client = await signedInAgent();

    const response = await client.patch('/api/tickets/999').send({ status: 'closed' });

    expect(response.status).toBe(404);
  });

  it.each([
    ['an empty body', {}],
    ['an unknown status', { status: 'archived' }],
    ['an unknown category', { category: 'spam' }],
    ['an empty assignee id', { assigneeId: '' }],
  ])('rejects %s with 400', async (_case, body) => {
    const { ticket } = await seedConversation();
    const client = await signedInAgent();

    expect((await client.patch(`/api/tickets/${ticket.id}`).send(body)).status).toBe(400);
  });
});

describe('GET /api/tickets/assignees', () => {
  it('rejects unauthenticated requests with 401', async () => {
    expect((await ctx.client().get('/api/tickets/assignees')).status).toBe(401);
  });

  it('lists active, non-deleted users by name', async () => {
    const admin = await ctx.createUser({ role: Role.admin });
    const agent = await ctx.createUser({ role: Role.agent });
    const inactive = await ctx.createUser({ active: false });
    const deleted = await ctx.createUser();
    await ctx.db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
    const client = await ctx.loginAs(agent.email);

    const response = await client.get('/api/tickets/assignees');

    expect(response.status).toBe(200);
    const { assignees } = listAssigneesResponseSchema.parse(response.body);
    expect(assignees).toEqual([
      { id: admin.id, name: 'Ada Admin' },
      { id: agent.id, name: 'Alan Agent' },
    ]);
    expect(assignees.map((a) => a.id)).not.toContain(inactive.id);
  });
});

describe('POST /api/tickets/:id/replies', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await ctx.client().post('/api/tickets/1/replies').send({ bodyText: 'Hi' });

    expect(response.status).toBe(401);
  });

  it('adds the reply at the end of the conversation, signed by the agent, and sets the ticket to pending', async () => {
    const { ticket } = await seedConversation();
    const replier = await ctx.createUser();
    const client = await ctx.loginAs(replier.email);

    const response = await client
      .post(`/api/tickets/${ticket.id}/replies`)
      .send({ bodyText: '  Try signing in again now.  ' });

    expect(response.status).toBe(201);
    const body = ticketResponseSchema.parse(response.body);
    expect(body.ticket.status).toBe('pending');
    expect(body.ticket.messages).toHaveLength(3);
    expect(body.ticket.messages.at(-1)).toMatchObject({
      direction: 'outbound',
      author: { id: replier.id, name: replier.name },
      bodyText: 'Try signing in again now.',
    });
  });

  it('responds 404 for a ticket that does not exist', async () => {
    const client = await signedInAgent();

    const response = await client.post('/api/tickets/999/replies').send({ bodyText: 'Hi' });

    expect(response.status).toBe(404);
  });

  it.each([
    ['a missing body', {}],
    ['an empty reply', { bodyText: '   ' }],
    ['a reply that is too long', { bodyText: 'x'.repeat(20_001) }],
  ])('rejects %s with 400', async (_case, body) => {
    const { ticket } = await seedConversation();
    const client = await signedInAgent();

    const response = await client.post(`/api/tickets/${ticket.id}/replies`).send(body);

    expect(response.status).toBe(400);
    expect(await ctx.db.message.count({ where: { ticketId: ticket.id } })).toBe(2);
  });
});
