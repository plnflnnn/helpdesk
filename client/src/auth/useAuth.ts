import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput } from '@helpdesk/shared';
import { fetchCurrentUser, signIn, signOut } from '@/api/auth';

export const currentUserQueryKey = ['currentUser'] as const;

/** The signed-in user (null when signed out), loaded once and shared through TanStack Query. */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      await signIn(input);
      return fetchCurrentUser();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserQueryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSettled: () => {
      queryClient.setQueryData(currentUserQueryKey, null);
      // Drop every other cached query so nothing from this session leaks to the next user.
      // (Not `clear()`: that would detach the route guard from the current-user query.)
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== currentUserQueryKey[0],
      });
    },
  });
}
