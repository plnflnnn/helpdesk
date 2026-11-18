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
  /** Enables AI reply polishing. Without it, the polish endpoint responds 503. */
  OPENAI_API_KEY: z.string().min(1).optional(),
  /** OpenAI model used to polish replies. */
  OPENAI_MODEL: z.string().min(1).default('gpt-5.4-mini'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
