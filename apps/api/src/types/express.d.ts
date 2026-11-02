import type { AuthUser } from '../lib/auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth from the VERIFIED token. Never read a user id from body/query/headers. */
      user?: AuthUser;
      /** Parsed + validated input, set by validate(). */
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}
export {};
