import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { Role, User } from '@helpdesk/shared';
import type { Auth } from '../auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: User;
    }
  }
}

/**
 * Resolves the session cookie to an active user and stores it on `req.user`.
 * Responds 401 when there is no valid session or the user has been deactivated.
 */
export function requireAuth(auth: Auth): RequestHandler {
  return async (req, res, next) => {
    const { headers, response: session } = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      // Better Auth may refresh the session (sliding expiry); pass its new cookie on to the browser.
      returnHeaders: true,
    });
    const setCookie = headers.getSetCookie();
    if (setCookie.length > 0) {
      res.append('Set-Cookie', setCookie);
    }

    if (!session || session.user.active !== true) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { user } = session;
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      active: true,
      createdAt: new Date(user.createdAt).toISOString(),
    };
    next();
  };
}

/** Must run after requireAuth. Responds 403 unless the user has the given role. */
export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
