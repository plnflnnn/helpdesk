import type { z } from 'zod';
import type { ErrorResponse } from '@helpdesk/shared';

/** 400 body for a failed Zod parse: the first issue's message, which the client can show as-is. */
export function validationError(error: z.ZodError): ErrorResponse {
  return { error: error.issues[0]?.message ?? 'Invalid request' };
}
