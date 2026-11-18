import { listUsersResponseSchema, Role, userResponseSchema } from '@helpdesk/shared';
import { createTestContext, PASSWORD } from '@/test/context.js';

const ctx = createTestContext();

beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

async function loginAdmin() {
  const admin = await ctx.createUser({ role: Role.admin });
  return { admin, client: await ctx.loginAs(admin.email) };
}

const newUser = {
  name: 'Grace Hopper',
  email: 'Grace@Example.com',
  password: 'grace-password',
};

describe('role checks', () => {
  it('rejects unauthenticated requests with 401', async () => {
    expect((await ctx.client().get('/api/users')).status).toBe(401);
  });

  it('rejects agents with 403', async () => {
    const agent = await ctx.createUser();
    const client = await ctx.loginAs(agent.email);

    expect((await client.get('/api/users')).status).toBe(403);
    expect((await client.post('/api/users').send(newUser)).status).toBe(403);
    expect((await client.patch(`/api/users/${agent.id}`).send({ active: false })).status).toBe(403);
    expect((await client.delete(`/api/users/${agent.id}`)).status).toBe(403);
  });

  it('lets admins list users', async () => {
    const { admin, client } = await loginAdmin();
    const agent = await ctx.createUser();

    const response = await client.get('/api/users');

    expect(response.status).toBe(200);
    const { users } = listUsersResponseSchema.parse(response.body);
    expect(users.map((u) => u.id).sort()).toEqual([admin.id, agent.id].sort());
  });
});

describe('POST /api/users', () => {
  it('creates an agent who can sign in with the given password', async () => {
    const { client } = await loginAdmin();

    const response = await client.post('/api/users').send(newUser);

    expect(response.status).toBe(201);
    expect(userResponseSchema.parse(response.body).user).toMatchObject({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: Role.agent,
      active: true,
    });
    const agentClient = await ctx.loginAs('grace@example.com', newUser.password);
    expect((await agentClient.get('/api/me')).body.user).toMatchObject({ role: Role.agent });
  });

  it('creates an admin when the role is given', async () => {
    const { client } = await loginAdmin();

    const response = await client.post('/api/users').send({ ...newUser, role: Role.admin });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe(Role.admin);
  });

  it('rejects a duplicate email with 409', async () => {
    const { admin, client } = await loginAdmin();

    const response = await client.post('/api/users').send({ ...newUser, email: admin.email });

    expect(response.status).toBe(409);
  });

  it.each([
    ['an empty name', { name: '' }, /Name is required/],
    ['an invalid email', { email: 'not-an-email' }, /valid email/],
    ['a short password', { password: 'short' }, /at least 8/],
    ['an unknown role', { role: 'owner' }, /./],
  ])('rejects %s with 400', async (_case, override, message) => {
    const { client } = await loginAdmin();

    const response = await client.post('/api/users').send({ ...newUser, ...override });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(message);
  });
});

describe('PATCH /api/users/:id', () => {
  it('updates name, email and role', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();

    const response = await client
      .patch(`/api/users/${agent.id}`)
      .send({ name: 'Renamed', email: 'New@Example.com', role: Role.admin });

    expect(response.status).toBe(200);
    expect(userResponseSchema.parse(response.body).user).toMatchObject({
      id: agent.id,
      name: 'Renamed',
      email: 'new@example.com',
      role: Role.admin,
    });
    await ctx.loginAs('new@example.com');
  });

  it('changes the password and logs the user out', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();
    const agentClient = await ctx.loginAs(agent.email);

    const response = await client
      .patch(`/api/users/${agent.id}`)
      .send({ password: 'brand-new-password' });

    expect(response.status).toBe(200);
    expect((await agentClient.get('/api/me')).status).toBe(401);
    await expect(ctx.loginAs(agent.email)).rejects.toThrow();
    await ctx.loginAs(agent.email, 'brand-new-password');
  });

  it('rejects an email that belongs to another user with 409', async () => {
    const { admin, client } = await loginAdmin();
    const agent = await ctx.createUser();

    const response = await client.patch(`/api/users/${agent.id}`).send({ email: admin.email });

    expect(response.status).toBe(409);
  });

  it('allows keeping the same email', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();

    const response = await client
      .patch(`/api/users/${agent.id}`)
      .send({ email: agent.email, name: 'Same Email' });

    expect(response.status).toBe(200);
  });

  it('rejects an empty update with 400', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();

    const response = await client.patch(`/api/users/${agent.id}`).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/at least one field/);
  });

  it('does not let admins change their own role', async () => {
    const { admin, client } = await loginAdmin();

    const response = await client.patch(`/api/users/${admin.id}`).send({ role: Role.agent });

    expect(response.status).toBe(400);
  });

  it('lets admins update their own name', async () => {
    const { admin, client } = await loginAdmin();

    const response = await client.patch(`/api/users/${admin.id}`).send({ name: 'Ada Lovelace' });

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Ada Lovelace');
  });

  it('returns 404 for an unknown user', async () => {
    const { client } = await loginAdmin();

    const response = await client.patch('/api/users/does-not-exist').send({ active: false });

    expect(response.status).toBe(404);
  });
});

describe('deactivation', () => {
  it('deletes the user’s sessions so they are logged out immediately', async () => {
    const { client: adminClient } = await loginAdmin();
    const agent = await ctx.createUser();
    const agentClient = await ctx.loginAs(agent.email);
    const secondDevice = await ctx.loginAs(agent.email);
    expect((await agentClient.get('/api/me')).status).toBe(200);

    const response = await adminClient.patch(`/api/users/${agent.id}`).send({ active: false });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: agent.id, active: false });
    expect(await ctx.db.session.count({ where: { userId: agent.id } })).toBe(0);
    expect((await agentClient.get('/api/me')).status).toBe(401);
    expect((await secondDevice.get('/api/me')).status).toBe(401);
  });

  it('blocks sign-in until the user is reactivated', async () => {
    const { client: adminClient } = await loginAdmin();
    const agent = await ctx.createUser();
    await adminClient.patch(`/api/users/${agent.id}`).send({ active: false });

    const blocked = await ctx
      .client()
      .post('/api/auth/sign-in/email')
      .send({ email: agent.email, password: PASSWORD });
    expect(blocked.status).toBe(403);

    await adminClient.patch(`/api/users/${agent.id}`).send({ active: true });
    const agentClient = await ctx.loginAs(agent.email);
    expect((await agentClient.get('/api/me')).status).toBe(200);
  });

  it('returns the deactivated agent’s tickets to the unassigned queue', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();
    const otherAgent = await ctx.createUser();
    const student = await ctx.db.student.create({ data: { email: 'student@example.com' } });
    const ticketFor = (assigneeId: string) =>
      ctx.db.ticket.create({ data: { subject: 'Help', studentId: student.id, assigneeId } });
    const unassigned = await ticketFor(agent.id);
    const kept = await ticketFor(otherAgent.id);

    const response = await client.patch(`/api/users/${agent.id}`).send({ active: false });

    expect(response.status).toBe(200);
    const tickets = await ctx.db.ticket.findMany({ select: { id: true, assigneeId: true } });
    expect(tickets).toEqual(
      expect.arrayContaining([
        { id: unassigned.id, assigneeId: null },
        { id: kept.id, assigneeId: otherAgent.id },
      ]),
    );
  });

  it('does not let admins deactivate themselves', async () => {
    const { admin, client } = await loginAdmin();

    const response = await client.patch(`/api/users/${admin.id}`).send({ active: false });

    expect(response.status).toBe(400);
    expect((await client.get('/api/me')).status).toBe(200);
  });
});

describe('DELETE /api/users/:id', () => {
  it('soft-deletes an agent: hidden from the list, signed out, and kept in the database', async () => {
    const { admin, client } = await loginAdmin();
    const agent = await ctx.createUser();
    const agentClient = await ctx.loginAs(agent.email);

    const response = await client.delete(`/api/users/${agent.id}`);

    expect(response.status).toBe(204);
    const { users } = listUsersResponseSchema.parse((await client.get('/api/users')).body);
    expect(users.map((u) => u.id)).toEqual([admin.id]);
    expect((await agentClient.get('/api/me')).status).toBe(401);
    const row = await ctx.db.user.findUnique({ where: { id: agent.id } });
    expect(row).toMatchObject({ active: false, deletedAt: expect.any(Date) });
  });

  it('returns the deleted agent’s tickets to the unassigned queue', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();
    const otherAgent = await ctx.createUser();
    const student = await ctx.db.student.create({ data: { email: 'student@example.com' } });
    const ticketFor = (assigneeId: string) =>
      ctx.db.ticket.create({ data: { subject: 'Help', studentId: student.id, assigneeId } });
    const [first, second] = [await ticketFor(agent.id), await ticketFor(agent.id)];
    const kept = await ticketFor(otherAgent.id);

    expect((await client.delete(`/api/users/${agent.id}`)).status).toBe(204);

    const tickets = await ctx.db.ticket.findMany({ select: { id: true, assigneeId: true } });
    expect(tickets).toEqual(
      expect.arrayContaining([
        { id: first.id, assigneeId: null },
        { id: second.id, assigneeId: null },
        { id: kept.id, assigneeId: otherAgent.id },
      ]),
    );
  });

  it('blocks a deleted user from signing in', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();
    await client.delete(`/api/users/${agent.id}`);

    const response = await ctx
      .client()
      .post('/api/auth/sign-in/email')
      .send({ email: agent.email, password: PASSWORD });

    expect(response.status).toBe(403);
  });

  it('does not delete admins, including yourself', async () => {
    const { admin, client } = await loginAdmin();
    const otherAdmin = await ctx.createUser({ role: Role.admin });

    for (const id of [admin.id, otherAdmin.id]) {
      const response = await client.delete(`/api/users/${id}`);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Admins cannot be deleted' });
    }
    expect(await ctx.db.user.count({ where: { deletedAt: { not: null } } })).toBe(0);
  });

  it('returns 404 for unknown or already deleted users, and they cannot be edited', async () => {
    const { client } = await loginAdmin();
    const agent = await ctx.createUser();
    await client.delete(`/api/users/${agent.id}`);

    expect((await client.delete(`/api/users/${agent.id}`)).status).toBe(404);
    expect((await client.delete('/api/users/no-such-user')).status).toBe(404);
    expect((await client.patch(`/api/users/${agent.id}`).send({ active: true })).status).toBe(404);
  });
});
