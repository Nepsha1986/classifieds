import { myListingsQuerySchema, updateProfileInputSchema } from '@classifieds/shared';
import { Router } from 'express';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { listOwnListings } from '../services/listings.service.js';
import { getProfile, updateProfile } from '../services/users.service.js';

export const meRouter = Router();

meRouter.use('/api/me', requireAuth);

meRouter.get('/api/me', async (req, res) => {
  res.json(await getProfile(getAuth(req).user.id));
});

meRouter.patch('/api/me', async (req, res) => {
  const input = updateProfileInputSchema.parse(req.body);
  res.json(await updateProfile(getAuth(req).user.id, input));
});

meRouter.get('/api/me/listings', async (req, res) => {
  const query = myListingsQuerySchema.parse(req.query);
  res.json(await listOwnListings(getAuth(req).user.id, query));
});
