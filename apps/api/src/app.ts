import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import express from 'express';
import { auth } from './auth/auth.js';
import { config } from './config.js';
import { LISTING_PHOTOS_DIR, LISTING_PHOTOS_URL } from './lib/uploads.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { categoriesRouter } from './routes/categories.js';
import { healthRouter } from './routes/health.js';
import { listingsRouter } from './routes/listings.js';
import { meRouter } from './routes/me.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // The frontends run on their own origins (merchant portal, public dashboard) and call the API with
  // the session cookie, so only the trusted origins get CORS with credentials. Mounted first so the
  // auth endpoints answer preflights too.
  app.use(
    cors({
      origin: config.TRUSTED_ORIGINS,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
    }),
  );

  // better-auth parses its own request bodies, so it must be mounted before express.json().
  // Sign-up / sign-in / sign-out etc. live under /api/auth/*.
  app.all('/api/auth/{*path}', toNodeHandler(auth));

  // Photo files have random, never-reused names, so they can be cached forever. Only the accepted-photo
  // dir is exposed (not the temp upload dir); missing files fall through to the JSON 404.
  app.use(
    LISTING_PHOTOS_URL,
    express.static(LISTING_PHOTOS_DIR, {
      index: false,
      dotfiles: 'deny',
      immutable: true,
      maxAge: '365d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use(categoriesRouter);
  app.use(meRouter);
  app.use(usersRouter);
  app.use(listingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
