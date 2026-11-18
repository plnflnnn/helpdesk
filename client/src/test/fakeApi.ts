import { jest } from '@jest/globals';
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { Role, type User } from '@helpdesk/shared';

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

/** Gets the parsed JSON request body and the query params. */
type Handler = (
  body: unknown,
  params: Record<string, string>,
) => { status: number; body?: unknown };

const realAdapter = axios.defaults.adapter;

/**
 * Replaces axios's HTTP adapter with handlers keyed by "METHOD /path". Unknown routes return 404.
 * Each handler gets the parsed JSON request body and the query params. Returns the jest mock so tests can inspect calls.
 */
export function mockApi(routes: Record<string, Handler>) {
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const key = `${config.method?.toUpperCase()} ${config.url}`;
    const handler = routes[key];
    const requestBody: unknown =
      typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const { status, body } = handler
      ? handler(requestBody, (config.params ?? {}) as Record<string, string>)
      : { status: 404, body: { error: 'Not found' } };
    const response: AxiosResponse = {
      data: body,
      status,
      statusText: '',
      headers: {},
      config,
    };
    if (status < 200 || status >= 300) {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response,
      );
    }
    return response;
  });
  axios.defaults.adapter = adapter;
  return adapter;
}

/** Undoes mockApi. */
export function restoreApi() {
  axios.defaults.adapter = realAdapter;
}

/** The parsed JSON body of the first request the mock received for `url`, if any. */
export function requestBody(adapter: ReturnType<typeof mockApi>, url: string): unknown {
  const call = adapter.mock.calls.find(([config]) => config.url === url);
  return call && typeof call[0].data === 'string' ? JSON.parse(call[0].data) : undefined;
}
