import * as Sentry from '@sentry/node';
import type { Env } from '@/env.js';

/** Reports errors to Sentry when `SERVER_SENTRY_DSN` is set; otherwise Sentry stays disabled. */
export function initSentry(env: Env, serverName: 'api' | 'worker') {
  if (!env.SERVER_SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SERVER_SENTRY_DSN,
    environment: env.NODE_ENV,
    serverName,
  });
}

export { captureException } from '@sentry/node';
