import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp, signedInHandlers } from './test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('renders the start page inside the layout for a signed-in user', async () => {
    mockApi(signedInHandlers);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'My listings' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Classifieds/ })).toBeTruthy();
  });

  it('renders a not-found page for unknown paths', async () => {
    mockApi(signedInHandlers);
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
