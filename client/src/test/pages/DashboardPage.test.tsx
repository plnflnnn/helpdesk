import { screen, within } from '@testing-library/react';
import type { DashboardStats } from '@helpdesk/shared';
import { formatDuration } from '@/pages/DashboardPage';
import { agentUser, mockApi, restoreApi } from '@/test/fakeApi';
import { renderApp } from '@/test/render';

afterEach(restoreApi);

const ticketsPerDay = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-11-${String(i + 1).padStart(2, '0')}`,
  count: i === 29 ? 7 : i % 3,
}));

const stats: DashboardStats = {
  totalTickets: 120,
  openTickets: 27,
  resolvedByAi: 30,
  averageResolutionSeconds: 5 * 3600 + 30 * 60,
  ticketsPerDay,
};

function mockDashboardApi(body: DashboardStats = stats) {
  return mockApi({
    'GET /api/me': () => ({ status: 200, body: { user: agentUser } }),
    'GET /api/dashboard': () => ({ status: 200, body: { stats: body } }),
  });
}

/** The value shown under a metric's label. */
async function metric(label: string) {
  const heading = await screen.findByRole('heading', { name: label });
  return heading.closest('[data-slot="card"]') as HTMLElement;
}

describe('dashboard page', () => {
  it('is the home page and shows the ticket metrics', async () => {
    const api = mockDashboardApi();

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await metric('Total tickets')).toHaveTextContent('120');
    expect(await metric('Open tickets')).toHaveTextContent('27');
    expect(await metric('Resolved by AI')).toHaveTextContent('30');
    expect(await metric('Resolved by AI (%)')).toHaveTextContent('25%');
    expect(await metric('Resolved by AI (%)')).toHaveTextContent('30 of 120 tickets');
    expect(await metric('Avg. resolution time')).toHaveTextContent('5.5h');
    // Days follow the browser's time zone.
    expect(api.mock.calls[1]![0].params).toEqual({
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it('lists tickets per day in a table for screen readers', async () => {
    mockDashboardApi();

    renderApp('/');

    const table = await screen.findByRole('table', { name: 'Tickets created per day' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(31);
    expect(rows.at(-1)).toHaveTextContent('Nov 30');
    expect(rows.at(-1)).toHaveTextContent('7');
  });

  it('shows a dash when no ticket has been resolved yet', async () => {
    mockDashboardApi({
      ...stats,
      totalTickets: 0,
      openTickets: 0,
      resolvedByAi: 0,
      averageResolutionSeconds: null,
    });

    renderApp('/');

    expect(await metric('Avg. resolution time')).toHaveTextContent('—');
    expect(await metric('Resolved by AI (%)')).toHaveTextContent('0%');
  });
});

describe('formatDuration', () => {
  it.each([
    [20, '1m'],
    [90, '2m'],
    [3600, '1h'],
    [5400, '1.5h'],
    [86_400, '1d'],
    [200_000, '2.3d'],
  ])('formats %d seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
