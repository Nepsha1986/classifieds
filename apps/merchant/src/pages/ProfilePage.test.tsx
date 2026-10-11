import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callsTo, mockApi, profile, renderApp, signedInHandlers } from '../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('profile page', () => {
  it('shows the profile and saves changes', async () => {
    const fetchMock = mockApi({
      ...signedInHandlers,
      'PATCH /api/me': ({ body }) => ({ body: { ...profile, ...(body as object) } }),
    });
    renderApp('/profile');

    expect(await screen.findByDisplayValue(profile.name)).toBeTruthy();
    expect(screen.getByText(/olena@demo\.classifieds · member since/)).toBeTruthy();
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe(profile.phone);

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), '  Olena K.  ');
    await userEvent.clear(screen.getByLabelText('City'));
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Profile saved.');
    // Trimmed by the shared schema; an emptied city is cleared (null).
    expect(callsTo(fetchMock, 'PATCH /api/me')[0]!.body).toEqual({
      name: 'Olena K.',
      phone: profile.phone,
      city: null,
    });
    // The header shows the new name straight away.
    expect(screen.getByText('Olena K.', { selector: '.app-user span' })).toBeTruthy();
    expect((screen.getByLabelText('City') as HTMLInputElement).value).toBe('');
  });

  it('validates the phone and name before sending', async () => {
    const fetchMock = mockApi(signedInHandlers);
    renderApp('/profile');
    await screen.findByDisplayValue(profile.name);
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.clear(screen.getByLabelText('Phone'));
    await userEvent.type(screen.getByLabelText('Phone'), 'call me');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Invalid phone number')).toBeTruthy();
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(callsTo(fetchMock, 'PATCH /api/me')).toHaveLength(0);
  });

  it('shows field errors from the API', async () => {
    mockApi({
      ...signedInHandlers,
      'PATCH /api/me': {
        status: 400,
        body: { error: 'Validation failed', details: { fieldErrors: { phone: ['Phone already used'] } } },
      },
    });
    renderApp('/profile');
    await screen.findByDisplayValue(profile.name);
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Phone already used')).toBeTruthy();
  });
});
