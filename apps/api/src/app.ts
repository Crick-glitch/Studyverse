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
import { flashcardsRouter } from './routes/flashcards.js';
import { importRouter } from './routes/import.js';
import { playerRouter } from './routes/player.js';
import { questionsRouter } from './routes/questions.js';
import { questsRouter } from './routes/quests.js';
import { tasksRouter } from './routes/tasks.js';
import { battlesRouter } from './routes/battles.js';
import { sessionsRouter } from './routes/sessions.js';
import { summaryRouter } from './routes/summary.js';

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
  /** Injectable clock (tests move time without sleeping). Defaults to the real time. */
  clock?: () => Date;
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
  // 100 KB for everything, except the CSV and local-data import routes (they carry whole files).
  const smallJson = express.json({ limit: '100kb' });
  const bigJson = express.json({ limit: '2mb' });
  const BIG_BODY = /^\/api\/v1\/(decks\/[^/]+\/csv\/(preview|import)|import\/local)$/;
  app.use((req, res, next) => (BIG_BODY.test(req.path) ? bigJson : smallJson)(req, res, next));

  const limiters = createRateLimiters(config);
  app.use('/api/v1', limiters.general);

  // Public
  app.use('/api/v1', healthRouter);

  // Everything below requires a verified Supabase token (verified once, before any private router).
  const auth = requireAuth(deps.verifyToken);
  const clock = deps.clock ?? (() => new Date());
  // The stricter auth-adjacent limit applies only to the profile routes, not to every private route.
  app.use(['/api/v1/me', '/api/v1/profile', '/api/v1/progress'], limiters.auth);
  app.use('/api/v1', auth);
  app.use('/api/v1', playerRouter(deps.prisma));
  app.use('/api/v1', sessionsRouter(deps.prisma, clock));
  app.use('/api/v1', battlesRouter(deps.prisma, clock, limiters));
  app.use('/api/v1', summaryRouter(deps.prisma, clock));
  app.use('/api/v1', tasksRouter(deps.prisma, clock));
  app.use('/api/v1', questsRouter(deps.prisma, clock));
  app.use('/api/v1', questionsRouter(deps.prisma));
  app.use('/api/v1', flashcardsRouter(deps.prisma, clock, limiters.importData));
  app.use('/api/v1', importRouter(deps.prisma, clock, limiters.importData));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
