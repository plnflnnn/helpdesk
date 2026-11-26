import type { Response } from 'express';
import type { z } from 'zod';

/** The parsed data, or null after responding 400 with the first issue's message. */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
  res: Response,
): z.output<T> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid request' });
    return null;
  }
  return result.data;
}
