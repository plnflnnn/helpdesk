import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, Role, roleSchema } from '@helpdesk/shared';
import prisma from '@/db.js';

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET environment variable is required');
}

/** The React app's public URL. In production the app and API share it. */
export const appUrl = process.env.APP_URL || vercelUrl() || 'http://localhost:3000';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  user: {
    additionalFields: {
      role: {
        type: [...roleSchema.options],
        required: false,
        defaultValue: Role.agent,
        input: false,
      },
      active: { type: 'boolean', required: false, defaultValue: true, input: false },
    },
  },
  // No cookie cache, so deleting a session row signs the user out on their next request.
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
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

/** Vercel sets the deployment's host without the scheme. */
function vercelUrl() {
  const host =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}
