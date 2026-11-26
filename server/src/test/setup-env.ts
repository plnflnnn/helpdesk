import { config } from 'dotenv';

// Runs before each test file: points the app at the test database with fixed settings.
config({ quiet: true });
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set (see server/.env.example)');
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  BETTER_AUTH_URL: 'http://localhost:4000',
  APP_URL: 'http://localhost:3000',
  SENDGRID_INBOUND_SECRET: 'test-inbound-secret-0123456789',
  SENDGRID_FROM_EMAIL: 'support@example.com',
  SENDGRID_API_KEY: '',
  OPENAI_API_KEY: '',
});
