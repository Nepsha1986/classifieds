import { Router } from 'express';
import { getPublicUser } from '../services/users.service.js';

export const usersRouter = Router();

usersRouter.get('/api/users/:id', async (req, res) => {
  res.json(await getPublicUser(req.params.id));
});
