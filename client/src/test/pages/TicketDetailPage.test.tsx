import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReplyInput, TicketDetail, UpdateTicketInput } from '@helpdesk/shared';
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

/**
 * Serves the ticket and applies updates and replies to it, like the server would.
 * `failWith` makes updates and replies fail with that status instead.
 */
function mockTicketApi({ failWith = 0 } = {}) {
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
    'POST /api/tickets/7/replies': (body) => {
      if (failWith) {
        return { status: failWith, body: { error: 'Something went wrong' } };
      }
      const reply = {
        id: `m${current.messages.length + 1}`,
        direction: 'outbound' as const,
        author: { id: agentUser.id, name: agentUser.name },
        bodyText: (body as ReplyInput).bodyText,
        createdAt: '2026-11-02T09:00:00.000Z',
      };
      current = { ...current, status: 'pending', messages: [...current.messages, reply] };
      return { status: 201, body: { ticket: current } };
    },
    'PATCH /api/tickets/7': (body) => {
      if (failWith) {
        return { status: failWith, body: { error: 'This agent does not exist or is inactive' } };
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
    const original = within(screen.getByRole('region', { name: 'Message' })).getByRole('article');
    expect(original).toHaveTextContent('Emma Thompson');
    expect(original).toHaveTextContent('The reset email never arrived.');
    const replies = within(screen.getByRole('region', { name: 'Replies (1)' })).getAllByRole(
      'article',
    );
    expect(replies).toHaveLength(1);
    expect(replies[0]).toHaveTextContent(agentUser.name);
    expect(replies[0]).toHaveTextContent('I have sent it again.');
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
    mockTicketApi({ failWith: 400 });
    renderApp('/tickets/7');
    await screen.findByRole('heading', { name: ticket.subject });

    await choose('Assignee', agentUser.name);

    expect(
      await screen.findByText('Could not save: This agent does not exist or is inactive'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Assignee' })).toHaveTextContent('Unassigned');
  });

  it('sends a reply, adds it to the thread and sets the ticket to pending', async () => {
    const api = mockTicketApi();
    renderApp('/tickets/7');
    await screen.findByRole('heading', { name: ticket.subject });

    fireEvent.change(screen.getByLabelText('Reply'), {
      target: { value: 'Please try signing in again.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));

    const replies = await screen.findByRole('region', { name: 'Replies (2)' });
    expect(within(replies).getAllByRole('article')[1]).toHaveTextContent(
      'Please try signing in again.',
    );
    expect(requestBody(api, '/api/tickets/7/replies', 'POST')).toEqual({
      bodyText: 'Please try signing in again.',
    });
    expect(screen.getByLabelText('Reply')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Pending');
  });

  it('does not send an empty reply', async () => {
    const api = mockTicketApi();
    renderApp('/tickets/7');
    await screen.findByRole('heading', { name: ticket.subject });

    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(await screen.findByText('Write a reply')).toBeInTheDocument();
    expect(requestBody(api, '/api/tickets/7/replies', 'POST')).toBeUndefined();
  });

  it('keeps the typed reply when sending fails', async () => {
    mockTicketApi({ failWith: 500 });
    renderApp('/tickets/7');
    await screen.findByRole('heading', { name: ticket.subject });

    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(
      await screen.findByText('Could not send the reply: Something went wrong'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Reply')).toHaveValue('Hello');
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
