import type { User } from '@helpdesk/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. */
      user: User;
    }
  }
}
