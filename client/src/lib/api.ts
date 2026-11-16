import type { z } from 'zod';

/** An HTTP error from our API. `message` is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    // Our routes send `{ error }`; Better Auth sends `{ code, message }`.
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
  } catch {
    // Not JSON.
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Sends a JSON request to the API (session cookie included) and parses the response with `schema`.
 * Throws ApiError for non-2xx responses.
 */
export async function apiFetch<T>(
  path: string,
  { schema, method = 'GET', body }: { schema?: z.ZodType<T>; method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  if (!schema || response.status === 204) {
    return undefined as T;
  }
  return schema.parse(await response.json());
}
