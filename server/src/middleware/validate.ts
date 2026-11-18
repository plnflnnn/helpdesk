import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { badRequest } from '@/errors.js';

type ValidationSchemas<Params extends z.ZodType, Body extends z.ZodType> = {
  params?: Params;
  body?: Body;
};

/**
 * Validates `req.params` and `req.body` with Zod schemas and stores the parsed (trimmed,
 * defaulted) values back on the request, so the next handler gets typed `req.params`/`req.body`.
 * Responds 400 with the first issue's message, which the client can show as-is.
 */
export function validate<
  Params extends z.ZodType = z.ZodType<Record<string, string>>,
  Body extends z.ZodType = z.ZodUnknown,
>({
  params,
  body,
}: ValidationSchemas<Params, Body>): RequestHandler<z.output<Params>, unknown, z.output<Body>> {
  return (req, _res, next) => {
    if (params) {
      req.params = parse(params, req.params);
    }
    if (body) {
      req.body = parse(body, req.body);
    }
    next();
  };
}

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
