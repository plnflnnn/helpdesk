import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { currentUserQueryKey } from '@/auth/useAuth';
import { ApiError } from './api';

/**
 * Any 401 from the API means the session is gone (logged out elsewhere, expired, or the user was
 * deactivated). Clearing the current user sends the protected routes back to the login page.
 */
export function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });

  function handleError(error: Error) {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.setQueryData(currentUserQueryKey, null);
    }
  }

  return queryClient;
}
