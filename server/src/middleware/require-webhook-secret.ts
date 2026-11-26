import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Checks `?secret=` against SENDGRID_INBOUND_SECRET. Without a configured secret, rejects everything. */
export const requireWebhookSecret: RequestHandler = (req, res, next) => {
  const secret = process.env.SENDGRID_INBOUND_SECRET;
  const provided = typeof req.query.secret === 'string' ? req.query.secret : '';

  if (!secret || !safeEqual(provided, secret)) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }
  next();
};

/** Constant-time comparison, so the secret can't be guessed from response times. */
function safeEqual(a: string, b: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}
