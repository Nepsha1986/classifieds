import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeNextPath } from './auth';
import { callsTo, mockApi, profile, renderApp, signedInHandlers, unauthorized } from './test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth guard', () => {
  it('sends a visitor without a session to sign-in', async () => {
    mockApi({ 'GET /api/me': unauthorized });
    const router = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
  });

  it('remembers the requested page and returns to it after sign-in', async () => {
    let signedIn = false;
    const fetchMock = mockApi({
      ...signedInHandlers,
      'GET /api/me': () => (signedIn ? { body: profile } : unauthorized),
      'POST /api/auth/sign-in/email': () => {
        signedIn = true;
        return { body: { user: profile } };
      },
    });
    const router = renderApp('/?x=1');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/?x=1')}`);

    await userEvent.type(screen.getByLabelText('Email'), ' Olena@Demo.Classifieds ');
    await userEvent.type(screen.getByLabelText('Password'), 'demo-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.location.search).toBe('?x=1');
    expect(callsTo(fetchMock, 'POST /api/auth/sign-in/email')[0]!.body).toEqual({
      email: 'olena@demo.classifieds',
      password: 'demo-password',
    });
    expect(await screen.findByText(profile.name)).toBeTruthy();
  });

  it('sends a signed-in user away from the sign-in page', async () => {
    mockApi(signedInHandlers);
    const router = renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'My listings' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows an error when the API is unreachable', async () => {
    mockApi({ 'GET /api/me': { status: 503, body: { error: 'Down' } } });
    renderApp('/');
    expect(await screen.findByText(/Could not reach the server/, {}, { timeout: 5000 })).toBeTruthy();
  });
});

describe('sign-in page', () => {
  it('validates input before calling the API', async () => {
    const fetchMock = mockApi({ 'GET /api/me': unauthorized });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
    expect(callsTo(fetchMock, 'POST /api/auth/sign-in/email')).toHaveLength(0);
  });

  it('shows the server error for wrong credentials', async () => {
    mockApi({
      'GET /api/me': unauthorized,
      'POST /api/auth/sign-in/email': {
        status: 401,
        body: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
      },
    });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.io');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });
});

describe('sign-up page', () => {
  it('creates an account and signs the user in', async () => {
    let signedUp = false;
    const fetchMock = mockApi({
      ...signedInHandlers,
      'GET /api/me': () => (signedUp ? { body: profile } : unauthorized),
      'POST /api/auth/sign-up/email': () => {
        signedUp = true;
        return { body: { user: profile } };
      },
    });
    const router = renderApp('/register');
    await screen.findByRole('heading', { name: 'Create an account' });
    await userEvent.type(screen.getByLabelText('Name'), 'Olena Kovalenko');
    await userEvent.type(screen.getByLabelText('Email'), 'olena@demo.classifieds');
    await userEvent.type(screen.getByLabelText('Password'), 'demo-password');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'My listings' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(callsTo(fetchMock, 'POST /api/auth/sign-up/email')[0]!.body).toEqual({
      name: 'Olena Kovalenko',
      email: 'olena@demo.classifieds',
      password: 'demo-password',
    });
  });

  it('rejects a short password and shows an existing-account error', async () => {
    const fetchMock = mockApi({
      'GET /api/me': unauthorized,
      'POST /api/auth/sign-up/email': {
        status: 422,
        body: { code: 'USER_ALREADY_EXISTS', message: 'User already exists. Use another email.' },
      },
    });
    renderApp('/register');
    await screen.findByRole('heading', { name: 'Create an account' });
    await userEvent.type(screen.getByLabelText('Name'), 'Ann');
    await userEvent.type(screen.getByLabelText('Email'), 'ann@b.io');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('At least 8 characters')).toBeTruthy();
    expect(callsTo(fetchMock, 'POST /api/auth/sign-up/email')).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Password'), '-long-enough');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('User already exists. Use another email.')).toBeTruthy();
  });
});

describe('sign-out', () => {
  it('ends the session and returns to sign-in', async () => {
    let signedIn = true;
    const fetchMock = mockApi({
      ...signedInHandlers,
      'GET /api/me': () => (signedIn ? { body: profile } : unauthorized),
      'POST /api/auth/sign-out': () => {
        signedIn = false;
        return { body: { success: true } };
      },
    });
    const router = renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/login');
    expect(callsTo(fetchMock, 'POST /api/auth/sign-out')).toHaveLength(1);
    expect(screen.queryByText(profile.name)).toBeNull();
  });
});

describe('safeNextPath', () => {
  it('only follows same-app paths', () => {
    expect(safeNextPath('/listings/1?x=2')).toBe('/listings/1?x=2');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
  });
});
