import { parseEnv } from '@/env.js';

const required = {
  DATABASE_URL: 'postgresql://user@localhost:5433/helpdesk',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:4000',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(required);

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      APP_URL: 'http://localhost:3000',
      OPENAI_MODEL: 'gpt-5-mini',
      KNOWLEDGE_BASE_PATH: 'knowledge-base.md',
      RUN_WORKER: false,
      ...required,
    });
  });

  it('parses RUN_WORKER as a boolean', () => {
    expect(parseEnv({ ...required, RUN_WORKER: 'true' }).RUN_WORKER).toBe(true);
    expect(parseEnv({ ...required, RUN_WORKER: 'false' }).RUN_WORKER).toBe(false);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is not a postgres URL', () => {
    expect(() => parseEnv({ ...required, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('defaults APP_URL and BETTER_AUTH_URL to RENDER_EXTERNAL_URL', () => {
    const env = parseEnv({
      DATABASE_URL: required.DATABASE_URL,
      BETTER_AUTH_SECRET: required.BETTER_AUTH_SECRET,
      RENDER_EXTERNAL_URL: 'https://helpdesk.onrender.com',
    });

    expect(env.APP_URL).toBe('https://helpdesk.onrender.com');
    expect(env.BETTER_AUTH_URL).toBe('https://helpdesk.onrender.com');
  });

  it('defaults BETTER_AUTH_URL to APP_URL', () => {
    const env = parseEnv({
      DATABASE_URL: required.DATABASE_URL,
      BETTER_AUTH_SECRET: required.BETTER_AUTH_SECRET,
      APP_URL: 'https://support.example.com',
      RENDER_EXTERNAL_URL: 'https://helpdesk.onrender.com',
    });

    expect(env.APP_URL).toBe('https://support.example.com');
    expect(env.BETTER_AUTH_URL).toBe('https://support.example.com');
  });

  it('throws when BETTER_AUTH_SECRET is shorter than 32 characters', () => {
    expect(() => parseEnv({ ...required, BETTER_AUTH_SECRET: 'short' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });
});
