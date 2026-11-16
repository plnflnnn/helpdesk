# Implementation Plan

Based on [project-scope.md](project-scope.md) and [tech-stack.md](tech-stack.md).

Each phase ends with something that works end to end. Tasks are small enough to finish and review in one sitting. AI features come after the manual workflow works, so the system is usable even when AI is unavailable.

---

## Phase 0 — Project Setup

- [x] Create monorepo structure: `client/` (React), `server/` (Express), `shared/` (types, Zod schemas)
- [x] Configure TypeScript, ESLint, and Prettier across all packages
- [x] Configure webpack for the client: ts-loader, HTML plugin, dev server with hot reload, production build
- [x] Set up Tailwind CSS (via PostCSS loader) and shadcn/ui in the client
- [x] Local PostgreSQL 17 + pgvector via Homebrew (port 5433); Docker deferred to Phase 9
- [x] Set up Prisma and connect to the local database (initial migration enables pgvector)
- [x] Add environment variable loading and validation with Zod (`.env.example` committed)
- [x] Create Express app skeleton with health check endpoint (`GET /api/health`)
- [x] Configure webpack dev server proxy from client to server
- [x] Set up Jest in server and client (with React Testing Library) with one passing test each
- [x] Set up Playwright with one smoke test (app loads)
- [x] Add npm scripts: `dev`, `build`, `test`, `lint`, `db:migrate`, `db:seed`

**Done when:** `npm run dev` starts client and server against the local database; health check returns OK; tests pass.

---

## Phase 1 — Authentication & User Management

### Backend
- [x] Add `User` model (name, email, role `admin | agent`, active flag) to Prisma schema
- [x] Install and configure Better Auth with Prisma adapter and database sessions
- [x] Configure session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) and inactivity expiry
- [x] Write seed script that creates the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- [x] Add `requireAuth` middleware (resolves session to user, rejects inactive users)
- [x] Add `requireRole('admin')` middleware
- [x] Endpoint: get current user (`GET /api/me`)

### Frontend
- [x] Login page with email/password form
- [x] Auth context / hook using TanStack Query for the current user
- [x] Protected route wrapper that redirects to login
- [x] App layout: sidebar navigation, header with user name and logout
- [x] Hide admin-only navigation from agents

### User management (admin)
- [x] Endpoints: list users, create agent, deactivate/reactivate user
- [x] Deactivation deletes all of the user's sessions
- [x] Add `Invite` model (token, expiry) and invite-token generation on agent creation
- [x] Set-password page reached from invite link
- [x] Users admin page: table of users, "Add agent" dialog, deactivate action
- [x] Tests: login, logout, role checks, deactivation revokes sessions, invite flow

**Done when:** admin can log in, create an agent, the agent sets a password via invite link and logs in, and deactivation logs the agent out immediately. (Invite emails are logged to the console until Phase 2 adds SendGrid.)

---

## Phase 2 — Email Intake & Ticket Data Model

### Data model
- [ ] Add `Student` model (email, name)
- [ ] Add `Ticket` model (number, subject, status, category, priority, assignee, student, timestamps, AI fields left nullable)
- [ ] Add `Message` model (ticket, direction inbound/outbound, author, body text/HTML, email headers `Message-ID`, `In-Reply-To`)
- [ ] Add `Attachment` model (message, filename, size, content type, storage key)
- [ ] Add `FilteredEmail` model for blocked emails

### Inbound email
- [ ] Set up SendGrid Inbound Parse pointing to `POST /webhooks/inbound` (use a tunnel such as ngrok locally)
- [ ] Verify webhook requests (shared secret in URL or basic auth)
- [ ] Parse incoming email: sender, subject, text/HTML body, headers
- [ ] Find or create `Student` by sender email
- [ ] Threading: match `In-Reply-To` / `References` to existing messages, then fall back to `support+T1234@` reply-to address
- [ ] Create new ticket or append message to existing ticket
- [ ] Reopen Resolved tickets on student reply; create a linked new ticket for Closed tickets
- [ ] Noise filter: `Auto-Submitted`, `Precedence: bulk`, `noreply` senders, spam score → `FilteredEmail`
- [ ] Upload attachments to R2/S3 (reject files over 10 MB)
- [ ] Tests: new ticket, threaded reply, reopen, closed → new ticket, filtered email, attachment handling

### Outbound email
- [ ] SendGrid Mail Send client wrapper
- [ ] Set `Message-ID`, `In-Reply-To`, `References`, and `Reply-To: support+T<id>@` headers on replies
- [ ] Send agent invite emails through SendGrid
- [ ] Configure SPF, DKIM, DMARC for the support domain (documented checklist)

**Done when:** sending an email to the support address creates a ticket in the database; replying to it threads correctly; auto-replies land in the filtered list.

---

## Phase 3 — Background Jobs

- [ ] Install and configure pg-boss
- [ ] Create `worker` entry point as a separate process
- [ ] Move outbound email sending into a job with retries
- [ ] Add retry policy helper (3 attempts, exponential backoff)
- [ ] Add npm script to run the worker in development alongside the server
- [ ] Tests: job enqueued and processed; failure after retries is recorded

**Done when:** outbound emails are sent from the worker and survive temporary SendGrid failures.

---

## Phase 4 — Ticket List & Detail (Manual Workflow)

### Ticket list
- [ ] Endpoint: list tickets with filters (status, category, priority, assignee, mine, unassigned), sorting, pagination
- [ ] Shared Zod schema for list query parameters
- [ ] Ticket list page with TanStack Table
- [ ] Filter controls and sort-by-column
- [ ] Pagination controls
- [ ] Persist filters in the URL query string

### Ticket detail
- [ ] Endpoint: get ticket with messages, attachments, student, and student's previous tickets
- [ ] Ticket detail page layout: header (subject, status, category, priority, assignee), thread, sidebar
- [ ] Conversation thread component (inbound vs outbound styling)
- [ ] Attachment list with download links (signed URLs)
- [ ] Student's previous tickets panel

### Replying
- [ ] Endpoint: send reply (saves outbound message, enqueues send job, sets status to Pending)
- [ ] Reply editor on ticket detail
- [ ] Optimistic UI update after sending
- [ ] Tests: list filters, detail endpoint, reply flow

**Done when:** an agent can find a ticket, read the whole conversation, reply, and the student receives the email.

---

## Phase 5 — Ticket Management: Status, Routing, Notes, Audit

### Status & fields
- [ ] Endpoint: update status, category, priority
- [ ] Status, category, priority dropdowns on ticket detail
- [ ] Scheduled job: close tickets 7 days after Resolved

### Routing
- [ ] Endpoint: claim ticket (agent) and assign ticket (admin)
- [ ] Endpoint: unassign
- [ ] Claim / assign controls on ticket detail
- [ ] "Being handled by X" banner and warning before replying to someone else's ticket
- [ ] On agent deactivation, return their claimed tickets to unassigned

### Internal notes
- [ ] Add `Note` model (ticket, author, body)
- [ ] Endpoints: add note, list notes
- [ ] Notes shown in the thread with distinct styling, clearly marked internal

### Audit log
- [ ] Add `TicketEvent` model (ticket, actor, type, old value, new value, timestamp)
- [ ] Record events for status, category, priority, assignment changes, replies, notes
- [ ] Activity history panel on ticket detail
- [ ] Tests: status transitions, auto-close job, claim conflicts, audit entries recorded

**Done when:** agents can claim, work, resolve, and close tickets with a full history of who did what.

---

## Phase 6 — Knowledge Base

- [ ] Add `Article` model (title, Markdown body, category, status draft/published) with pgvector `embedding` column
- [ ] Endpoints: list, get, create, update, delete articles (admin only for writes)
- [ ] Knowledge base list page
- [ ] Article editor page with Markdown preview
- [ ] Choose embedding provider and model; add embedding client
- [ ] Job: generate embedding when an article is created or updated
- [ ] Retrieval function: top 3–5 published articles by similarity with a relevance threshold
- [ ] Tests: CRUD, embedding job enqueued on save, retrieval returns relevant articles and nothing below threshold

**Done when:** admins can manage articles, and the retrieval function returns relevant articles for a sample ticket.

---

## Phase 7 — AI Features

### Foundation
- [ ] Claude API client wrapper with model constants (Haiku 5.5, Sonnet 5.5)
- [ ] Text preprocessing: strip signatures and quoted reply history; never include attachments
- [ ] Mark ticket "AI unavailable" after retries are exhausted
- [ ] Add AI fields to `Ticket`: `aiCategory`, `aiPriority`, `aiSummary`, `aiDraft`, `aiStatus`, `needsHuman` flag

### Classification
- [ ] Prompt and structured output schema (category from fixed list, priority)
- [ ] Job: classify new tickets (Haiku); Refund Requests default to High priority
- [ ] Store original AI values separately so agent overrides can be measured
- [ ] Show AI category/priority badge on ticket list and detail

### Summary
- [ ] Prompt for a short ticket summary
- [ ] Job: summarize on new ticket and on each student reply (Haiku)
- [ ] Summary panel on ticket detail

### Suggested reply
- [ ] Prompt combining ticket thread and retrieved knowledge base articles
- [ ] Job: draft reply on new ticket and on each student reply (Sonnet)
- [ ] No KB match → flag "Needs human: no KB match" and draft only a short acknowledgment
- [ ] Pre-fill reply editor with the draft; "Regenerate" button
- [ ] Record reply origin on send: AI unchanged / edited / manual
- [ ] Show "Needs human" flag in list and detail

### Quality
- [ ] Build a small set of sample tickets with expected categories for manual prompt testing
- [ ] Tests: jobs enqueued on intake, fallback on AI failure, preprocessing, reply origin tracking

**Done when:** new tickets are classified, summarized, and have a draft reply within seconds; agents can edit and send drafts; failures fall back to manual work.

---

## Phase 8 — Search, Dashboard, Notifications, Filtered Emails

### Search
- [ ] Add Postgres full-text index on ticket subject and message bodies
- [ ] Search endpoint (keyword or student email)
- [ ] Search box in the ticket list header

### Dashboard
- [ ] Endpoint: counts by status and category, unassigned count
- [ ] Endpoint: median time to first response
- [ ] Endpoint: AI draft acceptance rate and category override rate
- [ ] Dashboard page with stat tiles and simple charts

### Notifications
- [ ] Endpoint: unread counts (new tickets, student replies on my claimed tickets)
- [ ] Badge in navigation, polled with TanStack Query
- [ ] Mark-as-seen when a ticket is opened

### Filtered emails
- [ ] Admin page listing filtered emails
- [ ] Action: convert a filtered email into a ticket

**Done when:** agents can search tickets, see notification badges, and admins can view metrics and rescue filtered emails.

---

## Phase 9 — Hardening & Deployment

### Security & privacy
- [ ] Rate limiting on login and webhook endpoints
- [ ] Input validation with Zod on every endpoint
- [ ] Security headers (helmet) and CSRF protection for cookie-based sessions
- [ ] Scheduled job: delete tickets older than 2 years
- [ ] Document Anthropic and SendGrid as data processors

### Quality
- [ ] Playwright end-to-end tests for the main flows: login, receive ticket, reply, resolve, admin creates agent
- [ ] Error handling and empty/loading states across all pages
- [ ] Basic structured logging on server and worker

### Deployment
- [ ] Production Dockerfile (multi-stage build)
- [ ] Optional Docker Compose for local development (Postgres + pgvector), replacing the Homebrew setup
- [ ] Deploy to Railway or Render: managed Postgres with pgvector, web service, worker service
- [ ] Configure production environment variables and secrets
- [ ] Point SendGrid Inbound Parse at the production webhook
- [ ] Run migrations and seed the first admin in production
- [ ] Set monthly spending cap and alert in the Anthropic console
- [ ] Set up error monitoring and uptime check
- [ ] Production smoke test: send a real email end to end

**Done when:** the system runs in production and a real support email becomes a ticket with an AI draft that an agent can send.

---

## Phase Order and Dependencies

```
0 Setup ─▶ 1 Auth ─▶ 2 Email intake ─▶ 3 Jobs ─▶ 4 Ticket UI ─▶ 5 Ticket management
                                          │
                                          └──▶ 6 Knowledge base ─▶ 7 AI features
                                                                        │
                                       5 + 7 ──────────────────────────▶ 8 Search, dashboard
                                                                        │
                                                                        ▼
                                                                 9 Hardening & deploy
```

Phase 6 (knowledge base) can be built in parallel with Phases 4–5 once background jobs exist.
