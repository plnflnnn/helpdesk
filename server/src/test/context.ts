import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { LanguageModel } from 'ai';
import { hashPassword } from 'better-auth/crypto';
import { Role } from '@helpdesk/shared';
import { createApp } from '@/app.js';
import { createAuth } from '@/auth.js';
import { createPrismaClient } from '@/db.js';
import { testDatabaseUrl } from '@/test/database-url.js';

export const APP_URL = 'http://localhost:3000';
export const PASSWORD = 'correct-horse-battery';

type CreateTestUserOptions = {
  role?: Role;
  active?: boolean;
  email?: string;
};

type TestContextOptions = {
  /** Model for AI features; use a `MockLanguageModelV4` from `ai/test`. */
  aiModel?: LanguageModel;
};

/** A real app wired to the test database. Call `reset()` before each test and `close()` after all. */
export function createTestContext({ aiModel }: TestContextOptions = {}) {
  const db = createPrismaClient(testDatabaseUrl());
  const auth = createAuth(db, {
    NODE_ENV: 'test',
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    BETTER_AUTH_URL: 'http://localhost:4000',
    APP_URL,
  });
  const app = createApp({
    checkDatabase: async () => true,
    services: { db, auth, aiModel },
  });

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
          create: {
            id: randomUUID(),
            accountId: id,
            password: await hashPassword(PASSWORD),
          },
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
