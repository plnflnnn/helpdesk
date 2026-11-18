import type { LanguageModel } from 'ai';
import type { Role } from '@helpdesk/shared';
import type { Auth } from '@/auth.js';
import type { Database } from '@/db.js';
import type { Env } from '@/env.js';

/** Services the API routes need. */
export type Services = {
  db: Database;
  auth: Auth;
  /** Model for AI features (reply polishing, ticket summaries); unset when no OpenAI key is configured. */
  aiModel?: LanguageModel;
};

export type AppDependencies = {
  checkDatabase: () => Promise<boolean>;
  /** Auth and user routes are mounted only when set (health-check tests run without them). */
  services?: Services;
  /** Directory of the built React app. Served only when set (production). */
  clientDistPath?: string;
};

/** The subset of the environment that Better Auth needs. */
export type AuthConfig = Pick<
  Env,
  'NODE_ENV' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'APP_URL'
>;

/** The user columns selected from the database and turned into the API `User` shape. */
export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
};
