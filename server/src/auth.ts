import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, Role, roleSchema } from '@helpdesk/shared';
import type { Database } from '@/db.js';
import type { AuthConfig } from '@/types.js';

/** Sessions expire after this much inactivity. */
export const SESSION_INACTIVITY_SECONDS = 60 * 60 * 12;
/** While the user is active, the session expiry is pushed forward at most this often. */
export const SESSION_REFRESH_SECONDS = 60 * 60;

export function createAuth(db: Database, env: AuthConfig) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // The React app runs on its own origin in development (webpack dev server proxies /api).
    trustedOrigins: [env.APP_URL],
    database: prismaAdapter(db, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      // Users are created server-side (seed script, admin users page), never by public sign-up.
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    user: {
      additionalFields: {
        // `input: false`: these can never be set through Better Auth endpoints.
        role: {
          type: [...roleSchema.options],
          required: false,
          defaultValue: Role.agent,
          input: false,
        },
        active: { type: 'boolean', required: false, defaultValue: true, input: false },
      },
    },
    // Database sessions: each sign-in creates a row in `sessions`; the cookie holds only the token.
    // Cookie cache stays off, so deleting a session row revokes it on the very next request.
    session: {
      expiresIn: SESSION_INACTIVITY_SECONDS,
      updateAge: SESSION_REFRESH_SECONDS,
      cookieCache: { enabled: false },
    },
    advanced: {
      // Secure cookies need HTTPS, so they are only forced in production.
      useSecureCookies: env.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    databaseHooks: {
      session: {
        create: {
          // Deactivated users cannot sign in.
          before: async (session) => {
            const user = await db.user.findUnique({
              where: { id: session.userId },
              select: { active: true },
            });
            if (!user?.active) {
              throw new APIError('FORBIDDEN', { message: 'This account has been deactivated' });
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
