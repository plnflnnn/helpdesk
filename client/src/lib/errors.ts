import { isAxiosError } from 'axios';
import { errorResponseSchema } from '@helpdesk/shared';

/** The server's `{ error }` message when there is one, otherwise the error's own message. */
export function errorMessage(error: Error) {
  const body = isAxiosError(error) ? errorResponseSchema.safeParse(error.response?.data) : null;
  return body?.success ? body.data.error : error.message;
}
