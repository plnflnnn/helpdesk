# CLAUDE.md

## Imports

- Use the `@/` alias (maps to the package's `src/`) instead of relative paths (`./`, `../`) in `client` and `server`. Example: `import { createApp } from '@/app.js';`, not `'../app.js'`.
- Server imports keep the `.js` extension (`@/db.js`); client imports omit it (`@/lib/api`).
- The server's generated Prisma client is imported via `@generated/` (e.g. `@generated/prisma/client.js`).

## Tests

- Put test files (`*.test.ts`, `*.test.tsx`) under `src/test/`, mirroring the `src/` layout (e.g. `src/routes/users.ts` → `src/test/routes/users.test.ts`). Don't put them next to the code they test.
