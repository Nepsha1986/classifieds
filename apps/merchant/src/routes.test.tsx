import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from './query-client';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('routes', () => {
  it('renders the start page inside the layout', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Merchant portal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Classifieds/ })).toBeTruthy();
  });

  it('renders a not-found page for unknown paths', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
