import { config } from 'dotenv';

config({ quiet: true });

/** Tests never touch the development database: they require TEST_DATABASE_URL. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set (see server/.env.example)');
  }
  return url;
}
