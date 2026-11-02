import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, type ErrorBody } from '../lib/errors.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

/** Never leaks stack traces or internal messages to clients. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  void _next;
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  const status = typeof err?.status === 'number' && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(`[${String(req.headers['x-request-id'])}]`, err);
  const body: ErrorBody = {
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      message: status === 500 ? 'Something went wrong on our side.' : 'The request was invalid.',
    },
  };
  res.status(status).json(body);
};
