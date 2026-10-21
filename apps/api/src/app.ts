import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Config } from './config.js';
import { AppError } from './lib/errors.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './routes/health.js';

export function createApp(config: Pick<Config, 'CORS_ORIGINS'>): Express {
  const app = express();
  app.disable('x-powered-by');
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

  app.use('/api/v1', healthRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
