import { userResponseSchema, Role } from '@helpdesk/shared';
import { createTestContext, PASSWORD } from '@/test/context.js';

const ctx = createTestContext();

beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

describe('login', () => {
  it('signs in with email and password and resolves the current user', async () => {
    const admin = await ctx.createUser({ role: Role.admin });
    const client = ctx.client();

    const login = await client
      .post('/api/auth/sign-in/email')
      .send({ email: admin.email, password: PASSWORD });
    expect(login.status).toBe(200);

    const me = await client.get('/api/me');
    expect(me.status).toBe(200);
    expect(userResponseSchema.parse(me.body).user).toMatchObject({
      id: admin.id,
      email: admin.email,
      role: Role.admin,
      active: true,
    });
  });

  it('sets an HttpOnly, SameSite=Lax session cookie backed by a database session', async () => {
    const agent = await ctx.createUser();

    const login = await ctx
      .client()
      .post('/api/auth/sign-in/email')
      .send({ email: agent.email, password: PASSWORD });

    const cookie = (login.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('better-auth.session_token='),
    );
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(await ctx.db.session.count({ where: { userId: agent.id } })).toBe(1);
  });

  it('rejects a wrong password', async () => {
    const agent = await ctx.createUser();

    const login = await ctx
      .client()
      .post('/api/auth/sign-in/email')
      .send({ email: agent.email, password: 'wrong-password' });

    expect(login.status).toBe(401);
  });

  it('does not allow public sign-up', async () => {
    const response = await ctx
      .client()
      .post('/api/auth/sign-up/email')
      .send({ name: 'Mallory', email: 'mallory@example.com', password: PASSWORD });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await ctx.db.user.count()).toBe(0);
  });

  it('rejects deactivated users', async () => {
    const agent = await ctx.createUser({ active: false });

    const login = await ctx
      .client()
      .post('/api/auth/sign-in/email')
      .send({ email: agent.email, password: PASSWORD });

    expect(login.status).toBe(403);
    expect(await ctx.db.session.count()).toBe(0);
  });
});

describe('GET /api/me', () => {
  it('returns 401 without a session', async () => {
    const response = await ctx.client().get('/api/me');

    expect(response.status).toBe(401);
  });
});

describe('logout', () => {
  it('deletes the session so the cookie no longer works', async () => {
    const agent = await ctx.createUser();
    const client = await ctx.loginAs(agent.email);

    const logout = await client.post('/api/auth/sign-out').send({});
    expect(logout.status).toBe(200);

    expect(await ctx.db.session.count({ where: { userId: agent.id } })).toBe(0);
    expect((await client.get('/api/me')).status).toBe(401);
  });
});
