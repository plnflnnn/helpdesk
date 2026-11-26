import { waitUntil } from '@vercel/functions';
import { createApp } from '@/app.js';
import { createAuth } from '@/auth.js';
import { createPrismaClient, isDatabaseUp } from '@/db.js';
import { parseEnv } from '@/env.js';
import { createTicketHandlers } from '@/jobs/handlers.js';
import { createInlineJobQueue } from '@/jobs/inline.js';
import { createAiModel } from '@/services/ai.js';
import { createMailer } from '@/services/email.js';
import { initSentry } from '@/sentry.js';

// Entry point on Vercel (loaded by api/index.js): the Express app as one serverless function.
// There is no long-running worker there, so ticket jobs run right after the response
// (`waitUntil`) instead of through pg-boss. Vercel's CDN serves the React app, not Express.

const env = parseEnv(process.env);
initSentry(env, 'api');
const db = createPrismaClient(env.DATABASE_URL);
const mailer = createMailer(env);
const handlers = await createTicketHandlers({ db, mailer, env });

const app = createApp({
  checkDatabase: () => isDatabaseUp(db),
  services: {
    db,
    auth: createAuth(db, env),
    aiModel: createAiModel(env),
    mailer,
    jobs: createInlineJobQueue(handlers, { defer: waitUntil }),
    inboundEmailSecret: env.SENDGRID_INBOUND_SECRET,
  },
});

export default app;
