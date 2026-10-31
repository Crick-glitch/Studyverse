import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Config } from '../config.js';

type Limits = Pick<
  Config,
  | 'RATE_LIMIT_WINDOW_MS'
  | 'RATE_LIMIT_GENERAL_MAX'
  | 'RATE_LIMIT_AUTH_MAX'
  | 'RATE_LIMIT_BATTLE_ANSWER_MAX'
  | 'RATE_LIMIT_IMPORT_MAX'
>;

const make = (windowMs: number, limit: number): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again.',
        },
      });
    },
  });

/**
 * Separate buckets so a noisy route cannot starve the others. Counters are in memory (per process):
 * fine for one API instance; use a shared store (Redis) if the API is ever scaled horizontally.
 */
export function createRateLimiters(c: Limits) {
  return {
    general: make(c.RATE_LIMIT_WINDOW_MS, c.RATE_LIMIT_GENERAL_MAX),
    /** Auth-adjacent routes (/me, /profile): profile creation and name changes. */
    auth: make(c.RATE_LIMIT_WINDOW_MS, c.RATE_LIMIT_AUTH_MAX),
    /** Shared by POST /battles/:id/move, /ability and /answer. */
    battleAnswer: make(c.RATE_LIMIT_WINDOW_MS, c.RATE_LIMIT_BATTLE_ANSWER_MAX),
    /** Used by the local-data import route in a later phase. */
    importData: make(c.RATE_LIMIT_WINDOW_MS, c.RATE_LIMIT_IMPORT_MAX),
  };
}
export type RateLimiters = ReturnType<typeof createRateLimiters>;
