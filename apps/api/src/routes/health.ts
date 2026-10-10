import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/client.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    console.error('Health check: database unavailable', err);
    res.status(503).json({ status: 'error', db: 'unavailable' });
  }
});
