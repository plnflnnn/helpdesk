# CLAUDE.md

## Imports

- Use the `@/` alias (maps to the package's `src/`) instead of relative paths (`./`, `../`) in `client` and `server`. Example: `import { createApp } from '@/app.js';`, not `'../app.js'`.
- Server imports keep the `.js` extension (`@/db.js`); client imports omit it (`@/lib/api`).
- The server's generated Prisma client is imported via `@generated/` (e.g. `@generated/prisma/client.js`).

## Server architecture

Keep the server flat and simple: no service layer, no dependency injection, no classes.

```
src/
  app.ts       Express app: mounts every router, health check, error handler
  index.ts     Long-running entry (local/Render): startQueue() + app.listen()
  db.ts        `export default prisma` (singleton)
  env.ts       Loads .env; import it first in modules that read env at load time
  lib/         Shared logic: auth, queue + jobs, email, AI, validate, parse-id, sentry
  middleware/  require-auth, require-admin, require-webhook-secret, error-handler
  routes/      One Router per resource (default export)
  types/       express.d.ts (req.user)
```

- **Singletons, imported directly.** `import prisma from '@/db.js'`, `import { auth } from '@/lib/auth.js'`. Never pass `db`, `mailer`, or `queue` as parameters or props.
- **Routes hold the logic.** A handler parses input, runs Prisma queries and responds. Move code into `lib/` only when several routes or jobs share it (e.g. `lib/tickets.ts` selects, `lib/email-reply.ts`).
- **Handler pattern:**
  ```ts
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }
  const data = validate(schema, req.body, res); // sends 400 itself, returns null
  if (!data) return;
  ```
  Errors are always `res.status(code).json({ error: 'Human-readable message' })` inline. Don't throw custom HTTP errors. Unexpected errors fall through to `middleware/error-handler.ts` (500 + Sentry).
- **Validation schemas** live in `@helpdesk/shared` so the client uses the same ones.
- **Auth:** protect routers with `router.use(requireAuth)` (+ `requireAdmin`); then use `req.user`.
- **Background jobs:** one file per job in `lib/` (e.g. `lib/classify-ticket.ts` exports `classifyTicket(ticketId, signal?)`). Register it in the `handlers` map in `lib/queue.ts` and add a `sendXJob()` helper. Routes only call `sendXJob()`. Jobs must be safe to retry (re-check state before acting).
- **Deployment:** `index.ts` runs pg-boss in the same process (no separate worker). On Vercel (`process.env.VERCEL`), `api/index.js` imports `app` and `sendJob` runs the job via `waitUntil` instead of pg-boss. New code must work in both modes. Don't add long-running processes or rely on in-memory state between requests.
- **Comments:** only for non-obvious *why* (races, ordering, security). No comments restating the code.

## Tests

- Put test files (`*.test.ts`, `*.test.tsx`) under `src/test/`, mirroring the `src/` layout (e.g. `src/routes/users.ts` → `src/test/routes/users.test.ts`). Don't put them next to the code they test.
- Server tests use a real test database (`TEST_DATABASE_URL`, set up in `src/test/setup-env.ts`) and `createTestContext()` from `src/test/context.ts`.
- Mock modules (email, AI, queue) with `jest.unstable_mockModule(...)` and then `await import(...)` the code under test. For AI, use `mockAi()` / `modelReply()` from `src/test/mock-ai.ts`.
