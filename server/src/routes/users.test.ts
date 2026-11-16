import {
  createAgentResponseSchema,
  inviteDetailsSchema,
  listUsersResponseSchema,
  Role,
} from '@helpdesk/shared';
import { createTestContext, PASSWORD } from '../test/context.js';
import { hashToken } from '../users.js';

const ctx = createTestContext();

beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

async function loginAdmin() {
  const admin = await ctx.createUser({ role: Role.admin });
  return { admin, client: await ctx.loginAs(admin.email) };
}

describe('role checks', () => {
  it('rejects unauthenticated requests with 401', async () => {
    expect((await ctx.client().get('/api/users')).status).toBe(401);
  });

  it('rejects agents with 403', async () => {
    const agent = await ctx.createUser();
    const client = await ctx.loginAs(agent.email);

    expect((await client.get('/api/users')).status).toBe(403);
    expect(
      (await client.post('/api/users').send({ name: 'X', email: 'x@example.com' })).status,
    ).toBe(403);
    expect((await client.patch(`/api/users/${agent.id}`).send({ active: false })).status).toBe(403);
  });

  it('lets admins list users', async () => {
    const { admin, client } = await loginAdmin();
    const agent = await ctx.createUser();

    const response = await client.get('/api/users');

    expect(response.status).toBe(200);
    const { users } = listUsersResponseSchema.parse(response.body);
    expect(users.map((u) => u.id).sort()).toEqual([admin.id, agent.id].sort());
    expect(users.every((u) => !u.pendingInvite)).toBe(true);
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

  it('does not let admins deactivate themselves', async () => {
    const { admin, client } = await loginAdmin();

    const response = await client.patch(`/api/users/${admin.id}`).send({ active: false });

    expect(response.status).toBe(400);
    expect((await client.get('/api/me')).status).toBe(200);
  });

  it('returns 404 for an unknown user', async () => {
    const { client } = await loginAdmin();

    const response = await client.patch('/api/users/does-not-exist').send({ active: false });

    expect(response.status).toBe(404);
  });
});

describe('invite flow', () => {
  async function createAgent(client: Awaited<ReturnType<typeof loginAdmin>>['client']) {
    const response = await client
      .post('/api/users')
      .send({ name: 'Grace Hopper', email: 'Grace@Example.com' });
    expect(response.status).toBe(201);
    const body = createAgentResponseSchema.parse(response.body);
    const token = new URL(body.inviteUrl).searchParams.get('token')!;
    return { ...body, token };
  }

  it('creates an agent who sets a password from the invite link and logs in', async () => {
    const { client: adminClient } = await loginAdmin();

    const { user, inviteUrl, token } = await createAgent(adminClient);
    expect(user).toMatchObject({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: Role.agent,
      active: true,
      pendingInvite: true,
    });
    expect(inviteUrl).toMatch(/^http:\/\/localhost:3000\/set-password\?token=/);
    // Only the hash of the token is stored.
    expect(await ctx.db.invite.count({ where: { tokenHash: token } })).toBe(0);
    expect(await ctx.db.invite.count({ where: { tokenHash: hashToken(token) } })).toBe(1);

    const details = await ctx.client().get(`/api/invites/${token}`);
    expect(details.status).toBe(200);
    expect(inviteDetailsSchema.parse(details.body)).toEqual({
      name: 'Grace Hopper',
      email: 'grace@example.com',
    });

    const accepted = await ctx
      .client()
      .post(`/api/invites/${token}/accept`)
      .send({ password: 'grace-new-password' });
    expect(accepted.status).toBe(204);

    const agentClient = await ctx.loginAs('grace@example.com', 'grace-new-password');
    const me = await agentClient.get('/api/me');
    expect(me.body.user).toMatchObject({ email: 'grace@example.com', role: Role.agent });

    const list = listUsersResponseSchema.parse((await adminClient.get('/api/users')).body);
    expect(list.users.find((u) => u.id === user.id)?.pendingInvite).toBe(false);
  });

  it('can be used only once', async () => {
    const { client: adminClient } = await loginAdmin();
    const { token } = await createAgent(adminClient);
    await ctx.client().post(`/api/invites/${token}/accept`).send({ password: 'first-password' });

    const second = await ctx
      .client()
      .post(`/api/invites/${token}/accept`)
      .send({ password: 'second-password' });

    expect(second.status).toBe(404);
    expect((await ctx.client().get(`/api/invites/${token}`)).status).toBe(404);
    await expect(ctx.loginAs('grace@example.com', 'second-password')).rejects.toThrow();
  });

  it('rejects short passwords', async () => {
    const { client: adminClient } = await loginAdmin();
    const { token } = await createAgent(adminClient);

    const response = await ctx
      .client()
      .post(`/api/invites/${token}/accept`)
      .send({ password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/at least 8/);
  });

  it('rejects expired invites', async () => {
    const { client: adminClient } = await loginAdmin();
    const { token } = await createAgent(adminClient);
    await ctx.db.invite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await ctx.client().get(`/api/invites/${token}`)).status).toBe(404);
    const response = await ctx
      .client()
      .post(`/api/invites/${token}/accept`)
      .send({ password: 'grace-new-password' });
    expect(response.status).toBe(404);
  });

  it('rejects invites of deactivated users', async () => {
    const { client: adminClient } = await loginAdmin();
    const { user, token } = await createAgent(adminClient);
    await adminClient.patch(`/api/users/${user.id}`).send({ active: false });

    expect((await ctx.client().get(`/api/invites/${token}`)).status).toBe(404);
  });

  it('rejects unknown tokens', async () => {
    expect((await ctx.client().get('/api/invites/not-a-real-token')).status).toBe(404);
  });

  it('rejects duplicate emails and invalid input', async () => {
    const { admin, client } = await loginAdmin();

    const duplicate = await client.post('/api/users').send({ name: 'Copy', email: admin.email });
    expect(duplicate.status).toBe(409);

    const invalid = await client.post('/api/users').send({ name: '', email: 'not-an-email' });
    expect(invalid.status).toBe(400);
  });
});
