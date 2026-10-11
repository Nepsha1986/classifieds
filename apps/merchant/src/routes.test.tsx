import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, profile, renderApp } from './test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('renders the start page inside the layout for a signed-in user', async () => {
    mockApi({ 'GET /api/me': { body: profile } });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Merchant portal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Classifieds/ })).toBeTruthy();
  });

  it('renders a not-found page for unknown paths', async () => {
    mockApi({ 'GET /api/me': { body: profile } });
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
