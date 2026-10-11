import { Router } from 'express';
import { getCategoryTree } from '../services/categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get('/api/categories', async (_req, res) => {
  // Categories change only on deploy (seed), so clients and proxies may cache them briefly.
  res.set('Cache-Control', 'public, max-age=300').json(await getCategoryTree());
});
