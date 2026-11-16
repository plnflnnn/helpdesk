import {
  createAgentResponseSchema,
  inviteDetailsSchema,
  listUsersResponseSchema,
  updateUserResponseSchema,
  type CreateAgentInput,
} from '@helpdesk/shared';
import { apiFetch } from '@/lib/api';

export async function listUsers() {
  const { users } = await apiFetch('/api/users', { schema: listUsersResponseSchema });
  return users;
}

export function createAgent(input: CreateAgentInput) {
  return apiFetch('/api/users', { method: 'POST', body: input, schema: createAgentResponseSchema });
}

export async function setUserActive(id: string, active: boolean) {
  const { user } = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { active },
    schema: updateUserResponseSchema,
  });
  return user;
}

export function fetchInvite(token: string) {
  return apiFetch(`/api/invites/${encodeURIComponent(token)}`, { schema: inviteDetailsSchema });
}

export function acceptInvite(token: string, password: string) {
  return apiFetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: { password },
  });
}
