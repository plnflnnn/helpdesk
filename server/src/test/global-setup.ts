import { execSync } from 'node:child_process';
import { config } from 'dotenv';

// Runs outside the test module system, so it can't import other source files.
export default function globalSetup() {
  config({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set (see server/.env.example)');
  }
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
