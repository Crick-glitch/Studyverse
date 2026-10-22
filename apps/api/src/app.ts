import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Config } from './config.js';
import type { TokenVerifier } from './lib/auth.js';
import { AppError } from './lib/errors.js';
import type { PrismaClient } from './lib/prisma.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './routes/health.js';
import { playerRouter } from './routes/player.js';

export type AppConfig = Pick<
  Config,
  | 'CORS_ORIGINS'
  | 'TRUST_PROXY'
  | 'RATE_LIMIT_WINDOW_MS'
  | 'RATE_LIMIT_GENERAL_MAX'
  | 'RATE_LIMIT_AUTH_MAX'
  | 'RATE_LIMIT_BATTLE_ANSWER_MAX'
  | 'RATE_LIMIT_IMPORT_MAX'
>;

export interface AppDeps {
  prisma: PrismaClient;
  verifyToken: TokenVerifier;
}

export function createApp(config: AppConfig, deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Requests without an Origin header (curl, server-to-server) are not browser CORS calls.
        if (!origin || config.CORS_ORIGINS.includes(origin)) return cb(null, true);
        cb(new AppError(403, 'CORS_FORBIDDEN', 'Origin not allowed'));
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const limiters = createRateLimiters(config);
  app.use('/api/v1', limiters.general);

  // Public
  app.use('/api/v1', healthRouter);

  // Everything below requires a verified Supabase token.
  const auth = requireAuth(deps.verifyToken);
  app.use('/api/v1', limiters.auth, auth, playerRouter(deps.prisma));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
