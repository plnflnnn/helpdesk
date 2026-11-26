import type { ErrorRequestHandler } from 'express';
import Sentry from '@/lib/sentry.js';

/** Unexpected errors become a JSON 500 (and are reported to Sentry). */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  // Client errors raised by Express itself, e.g. malformed JSON.
  const status = typeof error?.status === 'number' ? error.status : 500;
  if (status < 500) {
    res.status(status).json({ error: 'Invalid request' });
    return;
  }

  console.error(error);
  Sentry.captureException(error);
  res.status(500).json({ error: 'Something went wrong' });
};
