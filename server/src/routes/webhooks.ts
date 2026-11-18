import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { unauthorized } from '@/errors.js';
import { parseInboundEmail, receiveEmail } from '@/services/inbound-email.js';
import type { Services } from '@/types.js';

/**
 * Attachments aren't stored yet, so their contents are read and thrown away instead of being held
 * in memory. Field values are capped generously: SendGrid limits a whole email to 30 MB.
 */
const upload = multer({
  storage: {
    _handleFile(_req, file, callback) {
      file.stream.on('error', callback);
      file.stream.on('end', () => callback(null, {}));
      file.stream.resume();
    },
    _removeFile(_req, _file, callback) {
      callback(null);
    },
  },
  limits: { fieldSize: 30 * 1024 * 1024 },
});

/** Webhooks called by outside services, authenticated by a shared secret instead of a session. */
export function webhooksRouter({ db, jobs, inboundEmailSecret }: Services) {
  const router = Router();

  // SendGrid Inbound Parse: one POST per email received, as multipart form data.
  // Configure its URL as https://<host>/webhooks/inbound?secret=<SENDGRID_INBOUND_SECRET>.
  router.post('/inbound', requireSecret(inboundEmailSecret), upload.any(), async (req, res) => {
    const email = parseInboundEmail(req.body ?? {});
    if (!email) {
      // Answering with an error would only make SendGrid retry the same email for days.
      console.warn('Ignored an inbound email without a valid sender');
      res.status(200).json({ outcome: 'ignored' });
      return;
    }
    const result = await receiveEmail({ db, jobs, email });
    res.status(200).json(result);
  });

  return router;
}

/** Rejects requests whose `?secret=` doesn't match. With no secret configured, rejects every request. */
function requireSecret(secret: string | undefined): RequestHandler {
  return (req, _res, next) => {
    const given = typeof req.query.secret === 'string' ? req.query.secret : '';
    if (!secret || !safeEqual(given, secret)) {
      throw unauthorized('Invalid webhook secret');
    }
    next();
  };
}

/** Constant-time comparison, so the secret can't be guessed from response times. */
function safeEqual(a: string, b: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}
