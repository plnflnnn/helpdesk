import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from '@helpdesk/shared';
import { FullPageMessage } from '@/components/FullPageMessage';
import { useCurrentUser } from '@/auth/useAuth';

/**
 * Renders children only for a signed-in user (with `role`, if given).
 * Signed-out users go to /login, which returns them here after signing in.
 */
export function ProtectedRoute({ role, children }: { role?: Role; children: ReactNode }) {
  const { data: user, isPending, isError } = useCurrentUser();
  const location = useLocation();

  if (isPending) {
    return <FullPageMessage>Loading…</FullPageMessage>;
  }
  if (isError) {
    return <FullPageMessage>Could not reach the server. Please refresh the page.</FullPageMessage>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
