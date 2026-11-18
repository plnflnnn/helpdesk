import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { adminUser, agentUser, mockApi, requestBody, restoreApi } from '@/test/fakeApi';
import { renderApp } from '@/test/render';

afterEach(restoreApi);

function fillLogin(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('authentication', () => {
  it('redirects signed-out users to the login page', async () => {
    mockApi({ 'GET /api/me': () => ({ status: 401, body: { error: 'Not authenticated' } }) });

    renderApp('/users');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs in and shows the app with the user name', async () => {
    let signedIn = false;
    const api = mockApi({
      'GET /api/me': () =>
        signedIn ? { status: 200, body: { user: agentUser } } : { status: 401, body: {} },
      'POST /api/auth/sign-in/email': () => {
        signedIn = true;
        return { status: 200, body: {} };
      },
    });
    renderApp('/');
    await screen.findByRole('heading', { name: 'Sign in' });

    fillLogin('alan@example.com', 'secret-password');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Alan Agent')).toBeInTheDocument();
    expect(requestBody(api, '/api/auth/sign-in/email')).toEqual({
      email: 'alan@example.com',
      password: 'secret-password',
    });
  });

  it('shows an error for wrong credentials', async () => {
    mockApi({
      'GET /api/me': () => ({ status: 401, body: {} }),
      'POST /api/auth/sign-in/email': () => ({ status: 401, body: { message: 'Invalid' } }),
    });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });

    fillLogin('alan@example.com', 'wrong');

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('validates the form before calling the API', async () => {
    const api = mockApi({ 'GET /api/me': () => ({ status: 401, body: {} }) });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });

    fillLogin('not-an-email', 'x');

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(requestBody(api, '/api/auth/sign-in/email')).toBeUndefined();
  });

  it('logs out and returns to the login page', async () => {
    let signedIn = true;
    mockApi({
      'GET /api/me': () =>
        signedIn ? { status: 200, body: { user: agentUser } } : { status: 401, body: {} },
      'POST /api/auth/sign-out': () => {
        signedIn = false;
        return { status: 200, body: { success: true } };
      },
    });
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('role-based navigation', () => {
  it('hides admin navigation from agents', async () => {
    mockApi({ 'GET /api/me': () => ({ status: 200, body: { user: agentUser } }) });

    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/tickets');
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('redirects agents away from admin pages', async () => {
    mockApi({ 'GET /api/me': () => ({ status: 200, body: { user: agentUser } }) });

    renderApp('/users');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('shows the Users page to admins', async () => {
    mockApi({
      'GET /api/me': () => ({ status: 200, body: { user: adminUser } }),
      'GET /api/users': () => ({
        status: 200,
        body: {
          users: [adminUser, { ...agentUser, active: false }],
        },
      }),
    });

    renderApp('/users');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByText('alan@example.com')).toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
  });
});

describe('editing users', () => {
  function mockUsersApi() {
    const updated = { ...agentUser, name: 'Alan Turing' };
    return mockApi({
      'GET /api/me': () => ({ status: 200, body: { user: adminUser } }),
      'GET /api/users': () => ({ status: 200, body: { users: [adminUser, agentUser] } }),
      [`PATCH /api/users/${agentUser.id}`]: () => ({ status: 200, body: { user: updated } }),
    });
  }

  async function openEditDialog() {
    renderApp('/users');
    fireEvent.click(await screen.findByRole('button', { name: `Edit ${agentUser.name}` }));
    return screen.findByRole('dialog');
  }

  it('fills the form with the user and keeps the password when left empty', async () => {
    const api = mockUsersApi();
    const dialog = await openEditDialog();

    expect(within(dialog).getByLabelText('Name')).toHaveValue(agentUser.name);
    expect(within(dialog).getByLabelText('Email')).toHaveValue(agentUser.email);
    expect(within(dialog).getByLabelText('New password')).toHaveValue('');

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Alan Turing' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requestBody(api, `/api/users/${agentUser.id}`)).toEqual({
      name: 'Alan Turing',
      email: agentUser.email,
    });
  });

  it('changes the password when one is entered', async () => {
    const api = mockUsersApi();
    const dialog = await openEditDialog();

    fireEvent.change(within(dialog).getByLabelText('New password'), {
      target: { value: 'new-secret-password' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(requestBody(api, `/api/users/${agentUser.id}`)).toEqual({
        name: agentUser.name,
        email: agentUser.email,
        password: 'new-secret-password',
      }),
    );
  });

  it('validates a too-short new password', async () => {
    const api = mockUsersApi();
    const dialog = await openEditDialog();

    fireEvent.change(within(dialog).getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await within(dialog).findByText(/at least 8 characters/)).toBeInTheDocument();
    expect(requestBody(api, `/api/users/${agentUser.id}`)).toBeUndefined();
  });
});

describe('deleting users', () => {
  it('asks for confirmation, then deletes the user', async () => {
    let deleted = false;
    const api = mockApi({
      'GET /api/me': () => ({ status: 200, body: { user: adminUser } }),
      'GET /api/users': () => ({
        status: 200,
        body: { users: deleted ? [adminUser] : [adminUser, agentUser] },
      }),
      [`DELETE /api/users/${agentUser.id}`]: () => {
        deleted = true;
        return { status: 204 };
      },
    });
    renderApp('/users');

    fireEvent.click(await screen.findByRole('button', { name: `Delete ${agentUser.name}` }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(`Delete ${agentUser.name}?`)).toBeInTheDocument();
    expect(deleted).toBe(false);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText(agentUser.email)).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.mock.calls.some(([config]) => config.method === 'delete')).toBe(true);
  });

  it('does not offer to delete admins', async () => {
    mockApi({
      'GET /api/me': () => ({ status: 200, body: { user: adminUser } }),
      'GET /api/users': () => ({ status: 200, body: { users: [adminUser, agentUser] } }),
    });
    renderApp('/users');

    expect(
      await screen.findByRole('button', { name: `Delete ${agentUser.name}` }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Delete ${adminUser.name}` }),
    ).not.toBeInTheDocument();
  });
});
