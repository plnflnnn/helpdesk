import { meResponseSchema, type LoginInput, type User } from '@helpdesk/shared';
import { ApiError, apiFetch } from '@/lib/api';

/** The signed-in user, or null when there is no valid session. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { user } = await apiFetch('/api/me', { schema: meResponseSchema });
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function signIn(input: LoginInput): Promise<void> {
  try {
    await apiFetch('/api/auth/sign-in/email', { method: 'POST', body: input });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, 'Invalid email or password');
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  await apiFetch('/api/auth/sign-out', { method: 'POST', body: {} });
}
