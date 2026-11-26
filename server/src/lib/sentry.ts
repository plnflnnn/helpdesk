import '@/env.js';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SERVER_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SERVER_SENTRY_DSN,
});

export default Sentry;
