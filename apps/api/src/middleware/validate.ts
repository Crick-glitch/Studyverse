import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../lib/errors.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Validates body/query/params with Zod. Parsed values land in req.valid; failures are 400s. */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    req.valid = {};
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        next(
          new AppError(
            400,
            'VALIDATION_ERROR',
            'The request did not pass validation.',
            result.error.issues.map((i) => ({
              path: [part, ...i.path].join('.'),
              message: i.message,
            })),
          ),
        );
        return;
      }
      req.valid[part] = result.data;
    }
    next();
  };
}

export type Valid<S extends ZodTypeAny> = z.infer<S>;
