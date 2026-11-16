import { jest } from '@jest/globals';
import { Role, type User } from '@helpdesk/shared';

type Handler = (init: RequestInit | undefined) => { status: number; body?: unknown };

export const adminUser: User = {
  id: 'admin-1',
  name: 'Ada Admin',
  email: 'ada@example.com',
  role: Role.admin,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const agentUser: User = {
  ...adminUser,
  id: 'agent-1',
  name: 'Alan Agent',
  email: 'alan@example.com',
  role: Role.agent,
};

/**
 * Replaces global fetch with handlers keyed by "METHOD /path". Unknown routes return 404.
 * Returns the jest mock so tests can inspect calls.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = routes[key];
    const { status, body } = handler
      ? handler(init)
      : { status: 404, body: { error: 'Not found' } };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  globalThis.fetch = fetchMock as typeof fetch;
  return fetchMock;
}
