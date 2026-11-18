import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ErrorResponse } from '@helpdesk/shared';
import { HttpError } from '@/errors.js';

/** 404 for any `/api` route that no router handled. */
export const apiNotFound: RequestHandler = (_req, res) => {
  const body: ErrorResponse = { error: 'Not found' };
  res.status(404).json(body);
};

/** Turns thrown `HttpError`s into their status; anything else is logged and becomes a 500. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    const body: ErrorResponse = { error: error.message };
    res.status(error.status).json(body);
    return;
  }

  console.error(error);
  const body: ErrorResponse = { error: 'Something went wrong' };
  res.status(500).json(body);
};
