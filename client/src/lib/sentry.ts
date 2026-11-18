import * as Sentry from '@sentry/react';
import type { RootOptions } from 'react-dom/client';

const enabled = Boolean(__SENTRY_DSN__);

/** Reports errors to Sentry when `CLIENT_SENTRY_DSN` was set at build time; otherwise Sentry stays disabled. */
export function initSentry() {
  if (!enabled) return;
  Sentry.init({
    dsn: __SENTRY_DSN__,
    environment: __APP_ENV__,
  });
}

// Custom root hooks replace React's default console logging, so keep logging too.
const logError = (error: unknown) => console.error(error);

/** React 19 root hooks that report render errors (caught by error boundaries or not) to Sentry. */
export const reactErrorHandlers: RootOptions = enabled
  ? {
      onUncaughtError: Sentry.reactErrorHandler(logError),
      onCaughtError: Sentry.reactErrorHandler(logError),
      onRecoverableError: Sentry.reactErrorHandler(logError),
    }
  : {};
