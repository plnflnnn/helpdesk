import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { currentUserQueryKey } from '@/auth/useAuth';

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
        retry: (failureCount, error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          return !(status !== undefined && status < 500) && failureCount < 2;
        },
      },
    },
  });

  function handleError(error: Error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      queryClient.setQueryData(currentUserQueryKey, null);
    }
  }

  return queryClient;
}
