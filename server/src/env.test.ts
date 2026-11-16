import { parseEnv } from './env.js';

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
      ...required,
    });
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is not a postgres URL', () => {
    expect(() => parseEnv({ ...required, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('throws when BETTER_AUTH_SECRET is shorter than 32 characters', () => {
    expect(() => parseEnv({ ...required, BETTER_AUTH_SECRET: 'short' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });
});
