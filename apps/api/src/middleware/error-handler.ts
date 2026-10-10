import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Validation failed', details: z.flattenError(err) });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
