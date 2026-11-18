import axios from 'axios';
import {
  listUsersResponseSchema,
  userResponseSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@helpdesk/shared';

export const usersQueryKey = ['users'] as const;

export async function listUsers() {
  const { data } = await axios.get('/api/users');
  return listUsersResponseSchema.parse(data).users;
}

export async function createUser(input: CreateUserInput) {
  const { data } = await axios.post('/api/users', input);
  return userResponseSchema.parse(data).user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const { data } = await axios.patch(`/api/users/${encodeURIComponent(id)}`, input);
  return userResponseSchema.parse(data).user;
}

export function setUserActive(id: string, active: boolean) {
  return updateUser(id, { active });
}
