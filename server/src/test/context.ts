import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';
import { Role } from '@helpdesk/shared';
import { app } from '@/app.js';
import db from '@/db.js';

export const APP_URL = process.env.APP_URL!;
export const PASSWORD = 'correct-horse-battery';
export const INBOUND_EMAIL_SECRET = process.env.SENDGRID_INBOUND_SECRET!;

type CreateTestUserOptions = {
  role?: Role;
  active?: boolean;
  email?: string;
};

/**
 * The app on the test database (see setup-env.ts). Call `reset()` before each test and `close()`
 * after all. In a test file that mocks modules, import this after `jest.unstable_mockModule`.
 */
export function createTestContext() {
  async function reset() {
    await db.$executeRaw`TRUNCATE TABLE "users", "sessions", "accounts", "verifications", "students", "tickets", "messages" RESTART IDENTITY CASCADE`;
  }

  async function createUser({
    role = Role.agent,
    active = true,
    email = `${role}-${randomUUID()}@example.com`,
  }: CreateTestUserOptions = {}) {
    const id = randomUUID();
    return db.user.create({
      data: {
        id,
        name: role === Role.admin ? 'Ada Admin' : 'Alan Agent',
        email,
        role,
        active,
        accounts: {
          create: { id: randomUUID(), accountId: id, password: await hashPassword(PASSWORD) },
        },
      },
    });
  }

  /** A supertest agent (keeps cookies) that sends the browser's Origin header. */
  function client() {
    return request.agent(app).set('Origin', APP_URL);
  }

  /** Signs in and returns a client holding the session cookie. */
  async function loginAs(email: string, password = PASSWORD) {
    const agent = client();
    const response = await agent.post('/api/auth/sign-in/email').send({ email, password });
    if (response.status !== 200) {
      throw new Error(`Sign-in failed with ${response.status}: ${JSON.stringify(response.body)}`);
    }
    return agent;
  }

  return { db, app, reset, createUser, client, loginAs, close: () => db.$disconnect() };
}
