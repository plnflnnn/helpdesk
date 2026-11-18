/**
 * An error with an HTTP status. Thrown anywhere in a request (routes, services) and turned into a
 * `{ error: message }` response by the error handler.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = 'Not authenticated') => new HttpError(401, message);
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const badGateway = (message: string) => new HttpError(502, message);
export const serviceUnavailable = (message: string) => new HttpError(503, message);
