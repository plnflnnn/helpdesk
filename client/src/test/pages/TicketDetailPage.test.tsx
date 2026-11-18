import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { TicketDetail, UpdateTicketInput } from '@helpdesk/shared';
import { adminUser, agentUser, mockApi, requestBody, restoreApi } from '@/test/fakeApi';
import { renderApp } from '@/test/render';

afterEach(restoreApi);

const ticket: TicketDetail = {
  id: 7,
  subject: 'Can’t log in after resetting my password',
  status: 'open',
  category: 'technical_question',
  priority: 'high',
  student: { email: 'emma@example.com', name: 'Emma Thompson' },
  assignee: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  messages: [
    {
      id: 'm1',
      direction: 'inbound',
      author: null,
      bodyText: 'The reset email never arrived.',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'm2',
      direction: 'outbound',
      author: { id: agentUser.id, name: agentUser.name },
      bodyText: 'I have sent it again.',
      createdAt: '2026-11-01T11:00:00.000Z',
    },
  ],
};

/** Serves the ticket and applies PATCHes to it, like the server would. */
function mockTicketApi({ patchStatus = 200 } = {}) {
  let current = ticket;
  const assignees = [
    { id: adminUser.id, name: adminUser.name },
    { id: agentUser.id, name: agentUser.name },
  ];
  return mockApi({
    'GET /api/me': () => ({ status: 200, body: { user: agentUser } }),
    'GET /api/tickets': () => ({ status: 200, body: { tickets: [current] } }),
    'GET /api/tickets/7': () => ({ status: 200, body: { ticket: current } }),
    'GET /api/tickets/assignees': () => ({ status: 200, body: { assignees } }),
    'PATCH /api/tickets/7': (body) => {
      if (patchStatus !== 200) {
        return { status: patchStatus, body: { error: 'This agent does not exist or is inactive' } };
      }
      const { assigneeId, ...fields } = body as UpdateTicketInput;
      current = { ...current, ...fields };
      if (assigneeId !== undefined) {
        current = { ...current, assignee: assignees.find((a) => a.id === assigneeId) ?? null };
      }
      return { status: 200, body: { ticket: current } };
    },
  });
}

async function choose(field: string, option: string) {
  const select = await screen.findByRole('combobox', { name: field });
  fireEvent.click(select);
  const item = await screen.findByRole('option', { name: option });
  // Base UI only accepts a mouse click on an option that the press started on.
  fireEvent.pointerDown(item, { pointerType: 'mouse' });
  fireEvent.click(item);
}

describe('ticket detail page', () => {
  it('opens from the subject link on the ticket list', async () => {
    mockTicketApi();
    renderApp('/');

    fireEvent.click(await screen.findByRole('link', { name: ticket.subject }));

    expect(await screen.findByRole('heading', { name: ticket.subject })).toBeInTheDocument();
  });

  it('shows the ticket and its conversation', async () => {
    mockTicketApi();

    renderApp('/tickets/7');

    expect(await screen.findByRole('heading', { name: ticket.subject })).toBeInTheDocument();
    expect(screen.getByText(/#7 · Emma Thompson <emma@example.com>/)).toBeInTheDocument();
    const conversation = screen.getByRole('region', { name: 'Conversation' });
    const messages = within(conversation).getAllByRole('article');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveTextContent('Emma Thompson');
    expect(messages[0]).toHaveTextContent('The reset email never arrived.');
    expect(messages[1]).toHaveTextContent(agentUser.name);
    expect(messages[1]).toHaveTextContent('I have sent it again.');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Open');
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent(
      'Technical Question',
    );
    expect(await screen.findByRole('combobox', { name: 'Assignee' })).toHaveTextContent(
      'Unassigned',
    );
  });

  it.each([
    ['Status', 'Resolved', { status: 'resolved' }],
    ['Category', 'Refund Request', { category: 'refund_request' }],
    ['Assignee', agentUser.name, { assigneeId: agentUser.id }],
  ])('updates the %s', async (field, option, expected) => {
    const api = mockTicketApi();
    renderApp('/tickets/7');
    await screen.findByRole('heading', { name: ticket.subject });

    await choose(field, option);

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: field })).toHaveTextContent(option),
    );
    expect(requestBody(api, '/api/tickets/7', 'PATCH')).toEqual(expected);
  });

  it('shows the server error when an update fails', async () => {
    mockTicketApi({ patchStatus: 400 });
    renderApp('/tickets/7');
    await screen.findByRole('heading', { name: ticket.subject });

    await choose('Assignee', agentUser.name);

    expect(
      await screen.findByText('Could not save: This agent does not exist or is inactive'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Assignee' })).toHaveTextContent('Unassigned');
  });

  it('says so when the ticket does not exist', async () => {
    mockTicketApi();

    renderApp('/tickets/404');

    expect(await screen.findByRole('heading', { name: 'Ticket not found' })).toBeInTheDocument();
  });

  it('says so for an invalid ticket id', async () => {
    mockTicketApi();

    renderApp('/tickets/abc');

    expect(await screen.findByRole('heading', { name: 'Ticket not found' })).toBeInTheDocument();
  });
});
