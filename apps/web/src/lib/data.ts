import { cache } from 'react';
import { api } from './endpoints';

// Deduplicated per request: generateMetadata and the page both need the same records.
export const getListing = cache(api.listing);
export const getUser = cache(api.user);
