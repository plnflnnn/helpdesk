# Tech Stack

## Overview

Full-stack TypeScript with a single PostgreSQL database and the Claude API for AI features.

Runtime versions: Node.js 24 LTS, TypeScript 6.0 (typescript-eslint and ts-jest do not support TypeScript 7 yet), PostgreSQL 17 with pgvector (local development via Homebrew on port 5433), Prisma 7 with the `@prisma/adapter-pg` driver adapter.

| Layer                 | Choice                             | Notes                                                                                               |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Language              | TypeScript                         | Used on frontend and backend; shared types                                                          |
| Frontend              | React (no Vite)                    | Plain React SPA bundled with webpack + ts-loader; dashboard sits behind login, no SSR needed        |
| UI                    | Tailwind CSS + shadcn/ui           | Tables, dialogs, forms                                                                              |
| Data fetching         | TanStack Query                     | Caching, refetching, mutations                                                                      |
| Tables                | TanStack Table                     | Ticket list filtering, sorting, pagination                                                          |
| Backend               | Node.js + Express                  | REST API and email webhooks                                                                         |
| Validation            | Zod                                | API input and AI output schemas, shared with frontend                                               |
| Database              | PostgreSQL                         | Tickets, messages, users, sessions, audit log                                                       |
| ORM                   | Prisma                             | Typed queries and migrations                                                                        |
| Knowledge base search | pgvector                           | Vector search inside Postgres for AI replies                                                        |
| Background jobs       | pg-boss                            | Postgres-backed queue for AI calls and outbound email                                               |
| Authentication        | Better Auth with database sessions | See below                                                                                           |
| Email (in + out)      | SendGrid                           | Inbound Parse webhook for incoming email; Mail Send API for outbound replies with threading headers |
| AI                    | Claude API                         | Haiku 5.5 for classification and summaries; Sonnet 5.5 for reply drafts                             |
| File storage          | S3 or Cloudflare R2                | Email attachments                                                                                   |
| Testing               | Jest + React Testing Library + Playwright | Unit/API/component tests and end-to-end tests                                                |
| Deployment            | Docker on Railway or Render        | Managed Postgres, web service, worker process                                                       |

## Authentication

- **Database sessions, not JWTs.** Each login creates a session row in Postgres (via Better Auth's Prisma adapter).
- The browser holds only an opaque session ID in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- Each request looks up the session in the database to resolve the user and their role.
- Sessions can be revoked immediately: logging out, or an admin deactivating an agent, deletes that user's session rows.
- Sessions expire after a fixed period of inactivity and are refreshed while the user is active.
- Roles (`admin`, `agent`) are stored on the user record and checked in Express middleware.
- The initial admin is created by a seed script using credentials from environment variables.

## Architecture

```
Student email ─▶ SendGrid Inbound Parse ─▶ POST /webhooks/inbound (Express)
                                  │ save ticket + message
                                  ▼
                             pg-boss job queue
                                  │
                ┌─────────────────┼──────────────────┐
           classify (Haiku)   summarize (Haiku)   draft reply (Sonnet + pgvector KB)
                                  │
                                  ▼
                 Agent reviews in React dashboard ─▶ send via SendGrid
```

**Rule:** AI work runs in background jobs, never inside the webhook request. Tickets are saved first, so an AI outage never loses incoming email and agents can still work tickets manually.

## Processes

- **web**: Express API + serves the built React app
- **worker**: pg-boss job consumers (AI classification, summaries, reply drafts, outbound email)
