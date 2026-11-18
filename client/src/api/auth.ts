import axios, { isAxiosError } from 'axios';
import { userResponseSchema, type LoginInput, type User } from '@helpdesk/shared';

/** The signed-in user, or null when there is no valid session. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { data } = await axios.get('/api/me');
    return userResponseSchema.parse(data).user;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function signIn(input: LoginInput): Promise<void> {
  try {
    await axios.post('/api/auth/sign-in/email', input);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      error.message = 'Invalid email or password';
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  await axios.post('/api/auth/sign-out', {});
}
