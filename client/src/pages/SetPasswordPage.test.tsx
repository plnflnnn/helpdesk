import { fireEvent, screen } from '@testing-library/react';
import { mockApi } from '@/test/fakeApi';
import { renderApp } from '@/test/render';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function fillPasswords(password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Set password' }));
}

describe('SetPasswordPage', () => {
  it('sets the password from a valid invite', async () => {
    const fetchMock = mockApi({
      'GET /api/invites/abc': () => ({
        status: 200,
        body: { name: 'Grace Hopper', email: 'grace@example.com' },
      }),
      'POST /api/invites/abc/accept': () => ({ status: 204 }),
    });
    renderApp('/set-password?token=abc');

    expect(await screen.findByText('Welcome, Grace Hopper.')).toBeInTheDocument();
    fillPasswords('a-long-password');

    expect(
      await screen.findByText('Your password is set. You can now sign in.'),
    ).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/invites/abc/accept');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ password: 'a-long-password' });
  });

  it('checks that the passwords match and are long enough', async () => {
    mockApi({
      'GET /api/invites/abc': () => ({
        status: 200,
        body: { name: 'Grace Hopper', email: 'grace@example.com' },
      }),
    });
    renderApp('/set-password?token=abc');
    await screen.findByText('Welcome, Grace Hopper.');

    fillPasswords('a-long-password', 'different-password');
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();

    fillPasswords('short');
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('explains when the invite is invalid or expired', async () => {
    mockApi({
      'GET /api/invites/old': () => ({
        status: 404,
        body: { error: 'This invite link is invalid or has expired. Ask an admin for a new one.' },
      }),
    });

    renderApp('/set-password?token=old');

    expect(await screen.findByText(/invalid or has expired/)).toBeInTheDocument();
  });
});
