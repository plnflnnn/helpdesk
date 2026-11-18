import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { TicketListItem } from '@helpdesk/shared';
import { agentUser, mockApi, restoreApi } from '@/test/fakeApi';
import { renderApp } from '@/test/render';

afterEach(restoreApi);

const loginTicket: TicketListItem = {
  id: 1,
  subject: 'Can’t log in after resetting my password',
  status: 'open',
  category: 'technical_question',
  priority: 'high',
  student: { email: 'emma@example.com', name: 'Emma Thompson' },
  assignee: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const refundTicket: TicketListItem = {
  id: 2,
  subject: 'Charged twice for the same course',
  status: 'pending',
  category: 'refund_request',
  priority: 'low',
  student: { email: 'nameless@example.com', name: null },
  assignee: { id: agentUser.id, name: agentUser.name },
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-03T10:00:00.000Z',
};

/** Serves the tickets in the order the requested sort gives, and records each request's params. */
function mockTicketsApi() {
  const requests: Record<string, string>[] = [];
  mockApi({
    'GET /api/me': () => ({ status: 200, body: { user: agentUser } }),
    'GET /api/tickets': (_body, params) => {
      requests.push(params);
      const bySubjectAsc = params.sortBy === 'subject' && params.sortOrder === 'asc';
      const tickets = bySubjectAsc ? [refundTicket, loginTicket] : [loginTicket, refundTicket];
      return { status: 200, body: { tickets } };
    },
  });
  return requests;
}

const subjectCells = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

describe('tickets page', () => {
  it('lists tickets with their details', async () => {
    mockTicketsApi();

    renderApp('/');

    expect(await screen.findByText(loginTicket.subject)).toBeInTheDocument();
    expect(screen.getByText('Emma Thompson')).toBeInTheDocument();
    expect(screen.getByText('nameless@example.com')).toBeInTheDocument();
    expect(screen.getByText('Technical Question')).toBeInTheDocument();
    expect(screen.getByText('Open', { selector: 'td *' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Subject',
      'Sender',
      'Status',
      'Category',
      'Created',
    ]);
  });

  it('asks the server for newest tickets first by default', async () => {
    const requests = mockTicketsApi();

    renderApp('/');

    await screen.findByText(loginTicket.subject);
    expect(requests[0]).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' });
    expect(screen.getByRole('columnheader', { name: /Created/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('sorts on the server when a column header is clicked, toggling the direction', async () => {
    const requests = mockTicketsApi();
    renderApp('/');
    await screen.findByText(loginTicket.subject);

    fireEvent.click(screen.getByRole('button', { name: /Subject/ }));

    await waitFor(() => expect(requests.at(-1)).toEqual({ sortBy: 'subject', sortOrder: 'asc' }));
    await waitFor(() =>
      expect(subjectCells()).toEqual([refundTicket.subject, loginTicket.subject]),
    );
    expect(screen.getByRole('columnheader', { name: /Subject/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    fireEvent.click(screen.getByRole('button', { name: /Subject/ }));

    await waitFor(() => expect(requests.at(-1)).toEqual({ sortBy: 'subject', sortOrder: 'desc' }));
  });

  it('starts the Created column descending', async () => {
    const requests = mockTicketsApi();
    renderApp('/?sortBy=subject&sortOrder=asc');
    await screen.findByText(loginTicket.subject);

    fireEvent.click(screen.getByRole('button', { name: /Created/ }));

    await waitFor(() =>
      expect(requests.at(-1)).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' }),
    );
  });

  it('reads the sort from the URL', async () => {
    const requests = mockTicketsApi();

    renderApp('/?sortBy=student&sortOrder=asc&status=open&search=refund');

    await screen.findByText(loginTicket.subject);
    expect(requests[0]).toEqual({
      sortBy: 'student',
      sortOrder: 'asc',
      status: 'open',
      search: 'refund',
    });
    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('refund');
  });

  it('searches on the server once typing pauses', async () => {
    const requests = mockTicketsApi();
    renderApp('/');
    await screen.findByText(loginTicket.subject);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tickets' }), {
      target: { value: '  charged twice ' },
    });

    await waitFor(() =>
      expect(requests.at(-1)).toEqual({
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'charged twice',
      }),
    );
    expect(requests).toHaveLength(2);
  });

  it.each([
    ['Status', 'Pending', { status: 'pending' }],
    ['Category', 'Refund Request', { category: 'refund_request' }],
  ])('filters by %s', async (filter, option, params) => {
    const requests = mockTicketsApi();
    renderApp('/');
    await screen.findByText(loginTicket.subject);

    fireEvent.click(screen.getByRole('combobox', { name: filter }));
    const item = await screen.findByRole('option', { name: option });
    // Base UI only accepts a mouse click on an option that the press started on.
    fireEvent.pointerDown(item, { pointerType: 'mouse' });
    fireEvent.click(item);

    await waitFor(() =>
      expect(requests.at(-1)).toEqual({ sortBy: 'createdAt', sortOrder: 'desc', ...params }),
    );
  });

  it('offers to clear filters when nothing matches', async () => {
    const requests: Record<string, string>[] = [];
    mockApi({
      'GET /api/me': () => ({ status: 200, body: { user: agentUser } }),
      'GET /api/tickets': (_body, params) => {
        requests.push(params);
        return { status: 200, body: { tickets: params.status ? [] : [loginTicket] } };
      },
    });
    renderApp('/?status=closed&search=zzz');

    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText(loginTicket.subject)).toBeInTheDocument();
    expect(requests.at(-1)).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' });
    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('');
  });

  it('shows an empty state when there are no tickets', async () => {
    mockApi({
      'GET /api/me': () => ({ status: 200, body: { user: agentUser } }),
      'GET /api/tickets': () => ({ status: 200, body: { tickets: [] } }),
    });

    renderApp('/');

    expect(await screen.findByText(/No tickets yet/)).toBeInTheDocument();
  });
});
