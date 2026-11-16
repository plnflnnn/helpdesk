import { fireEvent, screen, within } from '@testing-library/react';
import { adminUser, agentUser, mockApi } from '@/test/fakeApi';
import { renderApp } from '@/test/render';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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
    const fetchMock = mockApi({
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

    expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
    expect(screen.getByText('Alan Agent')).toBeInTheDocument();
    const signInCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/sign-in/email');
    expect(JSON.parse(String(signInCall?.[1]?.body))).toEqual({
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
    const fetchMock = mockApi({ 'GET /api/me': () => ({ status: 401, body: {} }) });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });

    fillLogin('not-an-email', 'x');

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/sign-in/email', expect.anything());
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
    expect(within(nav).getByRole('link', { name: 'Tickets' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('redirects agents away from admin pages', async () => {
    mockApi({ 'GET /api/me': () => ({ status: 200, body: { user: agentUser } }) });

    renderApp('/users');

    expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
  });

  it('shows the Users page to admins', async () => {
    mockApi({
      'GET /api/me': () => ({ status: 200, body: { user: adminUser } }),
      'GET /api/users': () => ({
        status: 200,
        body: {
          users: [
            { ...adminUser, pendingInvite: false },
            { ...agentUser, pendingInvite: true },
          ],
        },
      }),
    });

    renderApp('/users');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByText('alan@example.com')).toBeInTheDocument();
    expect(screen.getByText('Invite pending')).toBeInTheDocument();
  });
});
