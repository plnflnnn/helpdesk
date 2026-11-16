# Helpdesk

AI-powered support ticket system. See [project-scope.md](project-scope.md), [tech-stack.md](tech-stack.md), and [implementation-plan.md](implementation-plan.md).

## Requirements

- Node.js 24 (see `.nvmrc`)
- PostgreSQL 17 with pgvector

## Local setup (macOS)

```sh
# 1. Node 24 and PostgreSQL 17 + pgvector
brew install node@24 postgresql@17 pgvector
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"   # or add to ~/.zshrc

# 2. Run Postgres on port 5433 and create the databases
sed -i '' -E 's/^#?port = [0-9]+/port = 5433/' /opt/homebrew/var/postgresql@17/postgresql.conf
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb -p 5433 helpdesk
/opt/homebrew/opt/postgresql@17/bin/createdb -p 5433 helpdesk_test

# 3. Install dependencies (also generates the Prisma client)
npm install

# 4. Configure environment
cp server/.env.example server/.env   # then set USER in DATABASE_URL / TEST_DATABASE_URL, and ADMIN_*

# 5. Apply migrations and create the first admin (from ADMIN_EMAIL / ADMIN_PASSWORD)
npm run db:migrate
npm run db:seed

# 6. Browser for end-to-end tests
npx playwright install chromium
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Client on http://localhost:3000, API on http://localhost:4000 (client proxies `/api`) |
| `npm run build` | Build shared, server, and client |
| `npm start` | Run the built server (serves the built client when `NODE_ENV=production`) |
| `npm test` | Jest tests for server and client (server tests use `TEST_DATABASE_URL`, wiped between tests) |
| `npm run test:e2e` | Playwright end-to-end tests (starts dev servers automatically) |
| `npm run typecheck` | TypeScript checks for all packages |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run db:migrate` | Create/apply Prisma migrations |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Create the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (safe to re-run) |

## Project structure

```
client/   React app (webpack, Tailwind CSS, shadcn/ui)
server/   Express API, Prisma schema and migrations
shared/   Zod schemas and types used by client and server
e2e/      Playwright tests
```

## Users and invites

Public sign-up is disabled. The seed script creates the first admin; admins add agents on the **Users** page. Each new agent gets a one-time invite link (valid 7 days) to set their password. Until outbound email is added in Phase 2, the link is shown to the admin and logged by the server.
