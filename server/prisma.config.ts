import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env on its own.
config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` does not need a database, so allow it to run without DATABASE_URL.
    // Migrations need a direct connection: on Neon, DATABASE_URL goes through its connection pooler
    // and DATABASE_URL_UNPOOLED does not.
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
});
