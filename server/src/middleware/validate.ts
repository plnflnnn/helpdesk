import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { badRequest } from '@/errors.js';

type ValidationSchemas<
  Params extends z.ZodType,
  Body extends z.ZodType,
  Query extends z.ZodType,
> = {
  params?: Params;
  body?: Body;
  query?: Query;
};

/**
 * Validates `req.params`, `req.body` and `req.query` with Zod schemas and stores the parsed
 * (trimmed, defaulted) values back on the request, so the next handler gets them typed.
 * Responds 400 with the first issue's message, which the client can show as-is.
 */
export function validate<
  Params extends z.ZodType = z.ZodType<Record<string, string>>,
  Body extends z.ZodType = z.ZodUnknown,
  Query extends z.ZodType = z.ZodType<Record<string, unknown>>,
>({
  params,
  body,
  query,
}: ValidationSchemas<Params, Body, Query>): RequestHandler<
  z.output<Params>,
  unknown,
  z.output<Body>,
  z.output<Query>
> {
  return (req, _res, next) => {
    if (params) {
      req.params = parse(params, req.params);
    }
    if (body) {
      req.body = parse(body, req.body);
    }
    if (query) {
      // Express 5 defines `req.query` as a getter, so it can't simply be assigned.
      Object.defineProperty(req, 'query', {
        value: parse(query, req.query),
        writable: true,
        enumerable: true,
        configurable: true,
      });
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
