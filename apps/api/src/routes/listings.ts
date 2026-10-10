import {
  changeListingStatusInputSchema,
  createListingInputSchema,
  updateListingInputSchema,
} from '@classifieds/shared';
import { type Request, Router } from 'express';
import { getAuth, loadSession, requireAuth } from '../middleware/auth.js';
import {
  changeListingStatus,
  createListing,
  deleteListing,
  getListing,
  updateListing,
} from '../services/listings.service.js';

/** Express 5 typings drop route params when a middleware precedes the handler. */
type ListingRequest = Request<{ id: string }>;

export const listingsRouter = Router();

listingsRouter.post('/api/listings', requireAuth, async (req, res) => {
  const input = createListingInputSchema.parse(req.body);
  const listing = await createListing(getAuth(req).user.id, input);
  res.status(201).location(`/api/listings/${listing.id}`).json(listing);
});

listingsRouter.get('/api/listings/:id', loadSession, async (req: ListingRequest, res) => {
  res.json(await getListing(req.params.id, req.auth?.user.id));
});

listingsRouter.patch('/api/listings/:id', requireAuth, async (req: ListingRequest, res) => {
  const input = updateListingInputSchema.parse(req.body);
  res.json(await updateListing(req.params.id, getAuth(req).user.id, input));
});

listingsRouter.delete('/api/listings/:id', requireAuth, async (req: ListingRequest, res) => {
  await deleteListing(req.params.id, getAuth(req).user.id);
  res.status(204).end();
});

listingsRouter.patch('/api/listings/:id/status', requireAuth, async (req: ListingRequest, res) => {
  const input = changeListingStatusInputSchema.parse(req.body);
  res.json(await changeListingStatus(req.params.id, getAuth(req).user.id, input));
});
