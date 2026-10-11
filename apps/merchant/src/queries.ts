import type {
  CreateListingInput,
  ListingStatus,
  MyListingsQuery,
  UpdateListingInput,
} from '@classifieds/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, listingsApi, meApi } from './api/endpoints';

export const queryKeys = {
  categories: ['categories'] as const,
  myListings: ['my-listings'] as const,
  myListingsPage: (query: Partial<MyListingsQuery>) => ['my-listings', query] as const,
  listing: (id: string) => ['listing', id] as const,
};

export function useCategories() {
  // Categories change only on deploy (DECISIONS D16).
  return useQuery({ queryKey: queryKeys.categories, queryFn: categoriesApi.tree, staleTime: Infinity });
}

export function useMyListings(query: Partial<MyListingsQuery>) {
  return useQuery({
    queryKey: queryKeys.myListingsPage(query),
    queryFn: () => meApi.listings(query),
    placeholderData: (previous) => previous,
  });
}

export function useChangeListingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ListingStatus }) =>
      listingsApi.changeStatus(id, { status }),
    onSuccess: (listing) => {
      queryClient.setQueryData(queryKeys.listing(listing.id), listing);
      return queryClient.invalidateQueries({ queryKey: queryKeys.myListings });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => listingsApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.listing(id) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.myListings });
    },
  });
}

export function useListing(id: string) {
  return useQuery({ queryKey: queryKeys.listing(id), queryFn: () => listingsApi.get(id) });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListingInput) => listingsApi.create(input),
    onSuccess: (listing) => {
      queryClient.setQueryData(queryKeys.listing(listing.id), listing);
      return queryClient.invalidateQueries({ queryKey: queryKeys.myListings });
    },
  });
}

export function useUpdateListing(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateListingInput) => listingsApi.update(id, input),
    onSuccess: (listing) => {
      queryClient.setQueryData(queryKeys.listing(listing.id), listing);
      return queryClient.invalidateQueries({ queryKey: queryKeys.myListings });
    },
  });
}
