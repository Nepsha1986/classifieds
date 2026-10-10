import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import { auth } from './auth/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // better-auth parses its own request bodies, so it must be mounted before express.json().
  // Sign-up / sign-in / sign-out etc. live under /api/auth/*.
  app.all('/api/auth/{*path}', toNodeHandler(auth));

  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use(meRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
