import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { Role } from '@helpdesk/shared';
import { auth } from '@/lib/auth.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const { headers, response: session } = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    returnHeaders: true,
  });

  // Better Auth may extend the session; pass the refreshed cookie on to the browser.
  const setCookie = headers.getSetCookie();
  if (setCookie.length > 0) {
    res.append('Set-Cookie', setCookie);
  }

  if (!session || !session.user.active) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { id, name, email, role, createdAt } = session.user;
  req.user = {
    id,
    name,
    email,
    role: role as Role,
    active: true,
    createdAt: new Date(createdAt).toISOString(),
  };
  next();
};
