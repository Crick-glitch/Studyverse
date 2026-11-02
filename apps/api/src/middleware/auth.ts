import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import type { TokenVerifier } from '../lib/auth.js';

/** Protects a route: requires `Authorization: Bearer <Supabase access token>` and sets req.user. */
export function requireAuth(verify: TokenVerifier): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match?.[1]) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid credentials'));
      return;
    }
    verify(match[1]).then(
      (user) => {
        req.user = user;
        next();
      },
      (err: unknown) => next(err),
    );
  };
}

/** For handlers that run after requireAuth. */
export function currentUser(req: Express.Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid credentials');
  return req.user;
}
