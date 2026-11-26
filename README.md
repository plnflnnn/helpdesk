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
- pg-boss (Postgres-backed background job queue for local development; on Vercel, jobs run through `waitUntil`)
- Vercel AI SDK + OpenAI (classification, summaries, auto-replies, reply polishing)
- SendGrid (Inbound Parse webhook for incoming email, Mail Send for replies)
- Multer (parses the Inbound Parse form; attachments are not stored)

**Shared and tooling**

- Zod schemas shared by client and server (npm workspaces)
- Sentry error reporting (server and client)
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

Try it at https://helpdesk-theta-nine.vercel.app with the guest agent account:

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
| `npm run dev` | Client on http://localhost:3000, API on http://localhost:4000 (client proxies `/api`); the API server also runs the background jobs |
| `npm run build` | Build shared, server, and client |
| `npm start` | Run the built server (serves the built client when `NODE_ENV=production`) |
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

## Deploy to Vercel

On Vercel the API runs as one serverless function (`api/index.js` → `server/src/app.ts`), and Vercel's CDN serves the React app (`vercel.json`). There is no long-running worker, so the ticket jobs (AI classification and auto-resolve) run right after the response through `waitUntil`, retrying twice, instead of through pg-boss. A job that still fails leaves the ticket for agents.

1. In Vercel, import the repo (keep the root directory, settings come from `vercel.json`).
2. Under **Storage**, create a **Neon** Postgres database or connect an existing one. This sets `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used by migrations). If you set them by hand, take the direct URL from Neon with connection pooling turned off.
3. Add the environment variables: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and optionally `OPENAI_API_KEY`, `SENDGRID_INBOUND_SECRET`, and the Sentry DSNs.
4. Deploy. The build applies migrations and creates the admin.
5. Point SendGrid Inbound Parse at `https://<your-domain>/webhooks/inbound?secret=<SENDGRID_INBOUND_SECRET>`.

`APP_URL` and `BETTER_AUTH_URL` default to the production domain (`*.vercel.app`). Set `APP_URL` when you add a custom domain. Vercel limits request bodies to 4.5 MB, so inbound emails with larger attachments are rejected.

## Test the inbound email webhook

You can send a fake student email to the webhook with curl, without setting up SendGrid's inbound side. The question below is answered in [server/knowledge-base.md](server/knowledge-base.md), so with `OPENAI_API_KEY` set the AI should reply and resolve the ticket within about 30 seconds.

```sh
APP_URL="http://localhost:4000"          # or your deployed URL, e.g. https://<project>.vercel.app
SECRET="<SENDGRID_INBOUND_SECRET>"       # the webhook rejects every request while it is empty
STUDENT_NAME="<student-name>"
STUDENT_EMAIL="<student-email>"          # use your own inbox to receive the AI reply

curl -i -X POST "$APP_URL/webhooks/inbound?secret=$SECRET" \
  --form-string "from=$STUDENT_NAME <$STUDENT_EMAIL>" \
  --form-string "to=support@yourdomain.com" \
  --form-string "subject=I forgot my password" \
  --form-string "text=Hi, I forgot my password and can't log in to my courses. What should I do?" \
  --form-string "headers=Message-ID: <test-$(date +%s)-$RANDOM@example.com>"
```

Responses:

- `{"outcome":"created", ...}`: a new ticket was created, and classification and auto-resolve were queued.
- `{"outcome":"threaded", ...}`: the email was added as a reply to the student's existing ticket.
- `{"outcome":"duplicate"}`: an email with this `Message-ID` was already received.
- `{"outcome":"ignored"}`: the `from` field has no valid address. Keep the angle brackets: `Name <email>`.
- `401`: the secret doesn't match `SENDGRID_INBOUND_SECRET`.

Auto-resolve only answers a student's first message on a new, untouched ticket. A question the knowledge base doesn't cover (for example, team discounts) should leave the ticket open for agents. Each run needs a new `Message-ID`, or the email is treated as a duplicate.

## Project structure

```
client/   React app (webpack, Tailwind CSS, shadcn/ui)
server/   Express API and background jobs, Prisma schema and migrations, knowledge base
shared/   Zod schemas and types used by client and server
e2e/      Playwright tests
```

Inside `server/src`, routes hold the request logic and use the `prisma` and `auth` singletons directly. Shared code, background jobs and the queue live in `lib/`, and auth checks in `middleware/`. [CLAUDE.md](CLAUDE.md) describes the conventions.

## Users

Public sign-up is disabled. The seed script creates the first admin, and admins add agents on the **Users** page.

## More docs

[project-scope.md](project-scope.md), [tech-stack.md](tech-stack.md), [implementation-plan.md](implementation-plan.md)
