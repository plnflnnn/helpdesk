import { config } from 'dotenv';
import { z } from 'zod';

config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  /** Public URL of the React app: the trusted origin for auth requests. */
  APP_URL: z.url().default('http://localhost:3000'),
  /** Enables AI features (reply polishing, ticket summaries). Without it, those endpoints respond 503. */
  OPENAI_API_KEY: z.string().min(1).optional(),
  /** OpenAI model used for AI features. */
  OPENAI_MODEL: z.string().min(1).default('gpt-5.4-mini'),
  /** SendGrid key for outbound email. Without it (or the from address), emails are logged instead of sent. */
  SENDGRID_API_KEY: z.string().min(1).optional(),
  /** The support address emails are sent from; must be a verified sender in SendGrid. */
  SENDGRID_FROM_EMAIL: z.email().optional(),
  /** Shared secret in the Inbound Parse webhook URL. Without it, the webhook rejects every request. */
  SENDGRID_INBOUND_SECRET: z.string().min(16).optional(),
  /** Markdown file the AI answers new tickets from; relative paths are from the server folder. */
  KNOWLEDGE_BASE_PATH: z.string().min(1).default('knowledge-base.md'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
