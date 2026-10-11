import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';

const ME_KEY = 'me';

export function createQueryClient() {
  // A 401 from any request means the session is gone (expired, signed out elsewhere): forget the user so
  // the route guard sends them to sign-in.
  const onError = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) queryClient.setQueryData([ME_KEY], null);
  };
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (401, 403, 404, ...) will not change on retry; network and 5xx errors might.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
  return queryClient;
}
