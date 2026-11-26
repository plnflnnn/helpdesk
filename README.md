# Helpdesk

An AI-powered support ticket system for an online course platform. Student emails become tickets that the AI classifies and summarizes. When the knowledge base fully answers a question, the AI replies on its own; everything else goes to agents, who answer from a dashboard.

## Tools and frameworks

**Frontend**

- React 19 + TypeScript, bundled with webpack
- Tailwind CSS 4, shadcn/ui (Base UI), lucide-react icons
- TanStack Query (data fetching) and TanStack Table (ticket list)
- React Router, React Hook Form, Axios
- Recharts (dashboard charts)

**Backend**

- Node.js 24 + Express 5 + TypeScript
- PostgreSQL 17 + Prisma 7 (ORM and migrations)
- Better Auth (database sessions, admin/agent roles)
- pg-boss (Postgres-backed background job queue, run by a separate worker process)
- Vercel AI SDK + OpenAI (classification, summaries, auto-replies, reply polishing)
- SendGrid (Inbound Parse webhook for incoming email, Mail Send for replies)
- Multer (email attachments)

**Shared and tooling**

- Zod schemas shared by client and server (npm workspaces)
- Sentry error reporting (server, worker and client)
- Jest, React Testing Library, Supertest, Playwright
- ESLint, Prettier

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

# 5. Apply migrations, create the admin and the demo data
npm run db:migrate
npm run db:seed
npm run db:seed:replies   # optional: conversation history on resolved tickets

# 6. Browser for end-to-end tests
npx playwright install chromium
```

Then run `npm run dev` and open http://localhost:3000.

## Live demo

Try it at https://helpdesk-v0j3.onrender.com with the guest agent account:

| Email                       | Password          |
| --------------------------- | ----------------- |
| `guestagent@helpdesk.test`  | `5zgRrH4Da3Yi7HX` |

The account is shared, so you may see other visitors' changes.

## Demo accounts

Outside production, `npm run db:seed` creates 100 demo tickets and four demo agents:

| Role  | Email                         | Password                           |
| ----- | ----------------------------- | ---------------------------------- |
| Admin | `ADMIN_EMAIL` from `.env`     | `ADMIN_PASSWORD` from `.env`       |
| Agent | `sarah.chen@helpdesk.test`    | `demo-agent-password`              |
| Agent | `marcus.johnson@helpdesk.test` | `demo-agent-password`             |
| Agent | `priya.patel@helpdesk.test`   | `demo-agent-password`              |
| Agent | `diego.alvarez@helpdesk.test` | `demo-agent-password`              |

Set `DEMO_AGENT_PASSWORD` in `.env` to use a different agent password.

Without `SENDGRID_API_KEY`, outgoing emails are printed to the server console instead of being sent. Without `OPENAI_API_KEY`, the AI features are turned off.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Client on http://localhost:3000, API on http://localhost:4000 (client proxies `/api`), and the job worker |
| `npm run build` | Build shared, server, and client |
| `npm start` | Run the built server (serves the built client when `NODE_ENV=production`) |
| `npm run start:worker` | Run the built background job worker |
| `npm test` | Jest tests for server and client (server tests use `TEST_DATABASE_URL`, wiped between tests) |
| `npm run test:e2e` | Playwright end-to-end tests (starts dev servers automatically) |
| `npm run typecheck` | TypeScript checks for all packages |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run db:migrate` | Create/apply Prisma migrations |
| `npm run db:deploy` | Apply pending migrations without creating new ones (production) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Create the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, plus demo agents and tickets outside production (safe to re-run) |
| `npm run db:seed:replies` | Add demo conversations to resolved tickets (safe to re-run) |

## Deploy to Render

[render.yaml](render.yaml) is a Render Blueprint that creates three resources:

- **helpdesk**: a web service that runs the API and serves the built React app. Before each deploy it applies migrations (`npm run db:deploy`) and creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (no demo data in production).
- **helpdesk-worker**: a background worker that runs the pg-boss jobs (AI classification and auto-resolve).
- **helpdesk-db**: PostgreSQL 17. Render supports pgvector.

Steps:

1. Push the repo to GitHub or GitLab. In Render, choose **New → Blueprint** and select the repo.
2. Fill in the values Render asks for:
   - Required: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`.
   - On the worker, `APP_URL`: the web service URL, e.g. `https://helpdesk.onrender.com`.
   - Optional: `OPENAI_API_KEY`, `SENDGRID_INBOUND_SECRET` (`openssl rand -hex 24`), and the Sentry DSNs.
3. Point SendGrid Inbound Parse at `https://<your-host>/webhooks/inbound?secret=<SENDGRID_INBOUND_SECRET>`.

To skip the separate worker (Render background workers have no free plan), set `RUN_WORKER=true` and `OPENAI_API_KEY` on the web service: it then runs the jobs itself. Delete the worker service so that only one process consumes the queue (two would also work, but cost more).

On the web service, `APP_URL` and `BETTER_AUTH_URL` default to its `onrender.com` URL. If you add a custom domain, set `APP_URL` on both services. `BETTER_AUTH_SECRET` is generated once and shared through the `helpdesk-shared` environment group.

## Deploy to Vercel

On Vercel the API runs as one serverless function (`api/index.js` → `server/src/vercel.ts`), and Vercel's CDN serves the React app (`vercel.json`). There is no long-running worker, so the ticket jobs (AI classification and auto-resolve) run right after the response through `waitUntil`, retrying twice, instead of through pg-boss. A job that still fails leaves the ticket for agents.

1. In Vercel, import the repo (keep the root directory, settings come from `vercel.json`).
2. Under **Storage**, create a **Neon** Postgres database or connect an existing one. This sets `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used by migrations). If you set them by hand, take the direct URL from Neon with connection pooling turned off.
3. Add the environment variables: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and optionally `OPENAI_API_KEY`, `SENDGRID_INBOUND_SECRET`, and the Sentry DSNs.
4. Deploy. The build applies migrations and creates the admin.
5. Point SendGrid Inbound Parse at `https://<your-domain>/webhooks/inbound?secret=<SENDGRID_INBOUND_SECRET>`.

`APP_URL` and `BETTER_AUTH_URL` default to the production domain (`*.vercel.app`). Set `APP_URL` when you add a custom domain. Vercel limits request bodies to 4.5 MB, so inbound emails with larger attachments are rejected.

## Project structure

```
client/   React app (webpack, Tailwind CSS, shadcn/ui)
server/   Express API, job worker, Prisma schema and migrations, knowledge base
shared/   Zod schemas and types used by client and server
e2e/      Playwright tests
```

## Users

Public sign-up is disabled. The seed script creates the first admin, and admins add agents on the **Users** page.

## More docs

[project-scope.md](project-scope.md), [tech-stack.md](tech-stack.md), [implementation-plan.md](implementation-plan.md)
