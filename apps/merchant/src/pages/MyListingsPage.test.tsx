import type { Listing } from '@classifieds/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callsTo,
  makeListing,
  mockApi,
  page,
  renderApp,
  signedInHandlers,
  unauthorized,
} from '../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function row(title: string) {
  return within(screen.getByRole('listitem', { name: title }));
}

/** A fake API holding `listings` in memory, so status changes and deletes show up on refetch. */
function mockListingsApi(listings: Listing[]) {
  let items = [...listings];
  return mockApi({
    ...signedInHandlers,
    'GET /api/me/listings': ({ url }) => {
      const status = url.searchParams.get('status');
      const filtered = status ? items.filter((l) => l.status === status) : items;
      return { body: page(filtered, { page: Number(url.searchParams.get('page') ?? 1) }) };
    },
    ...Object.fromEntries(
      listings.flatMap((l) => [
        [
          `PATCH /api/listings/${l.id}/status`,
          ({ body }: { body: unknown }) => {
            const { status } = body as { status: Listing['status'] };
            items = items.map((i) => (i.id === l.id ? { ...i, status } : i));
            return { body: items.find((i) => i.id === l.id) };
          },
        ],
        [
          `DELETE /api/listings/${l.id}`,
          () => {
            items = items.filter((i) => i.id !== l.id);
            return { status: 204 };
          },
        ],
      ]),
    ),
  });
}

describe('my listings page', () => {
  it('lists own listings with status, price, category and the actions each status allows', async () => {
    mockListingsApi([
      makeListing({
        title: 'iPhone 15',
        price: 3_200_000,
        photos: [
          {
            id: '10000000-0000-4000-8000-000000000001',
            url: '/uploads/listings/a.png',
            position: 0,
            createdAt: '2026-10-05T10:00:00.000Z',
          },
        ],
      }),
      makeListing({ title: 'Old bike', status: 'paused', price: null, categoryId: 2, city: 'Lviv' }),
      makeListing({ title: 'Sofa', status: 'sold' }),
    ]);
    renderApp('/');

    await screen.findByRole('listitem', { name: 'iPhone 15' });
    const phone = row('iPhone 15');
    expect(phone.getByText('Active')).toBeTruthy();
    expect(phone.getByText(/32,000/)).toBeTruthy();
    expect(await phone.findByText(/Electronics \/ Phones · Kyiv/)).toBeTruthy();
    // The cover is decorative (alt=""), so it has no img role.
    const cover = screen.getByRole('listitem', { name: 'iPhone 15' }).querySelector('img');
    expect(cover?.getAttribute('src')).toBe('/uploads/listings/a.png');
    expect(phone.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Pause',
      'Mark as sold',
      'Delete',
    ]);

    const bike = row('Old bike');
    expect(bike.getByText('Paused')).toBeTruthy();
    expect(bike.getByText('Price on request')).toBeTruthy();
    expect(bike.getByText(/Transport \/ Cars · Lviv/)).toBeTruthy();
    expect(bike.getByText('No photo')).toBeTruthy();
    expect(bike.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Activate',
      'Mark as sold',
      'Delete',
    ]);

    // Sold is final: only delete is left.
    expect(
      row('Sofa')
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Delete']);
    expect(screen.getByText('3 listings')).toBeTruthy();
  });

  it('filters by status through the URL', async () => {
    const fetchMock = mockListingsApi([
      makeListing({ title: 'Active one' }),
      makeListing({ title: 'Paused one', status: 'paused' }),
    ]);
    const router = renderApp('/');
    await screen.findByRole('listitem', { name: 'Active one' });

    await userEvent.click(screen.getByRole('button', { name: 'Paused' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Active one' })).toBeNull());
    expect(screen.getByRole('listitem', { name: 'Paused one' })).toBeTruthy();
    expect(router.state.location.search).toBe('?status=paused');
    expect(callsTo(fetchMock, 'GET /api/me/listings').at(-1)!.url.searchParams.get('status')).toBe('paused');
    expect(screen.getByRole('button', { name: 'Paused' }).getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Sold' }));
    expect(await screen.findByText('No sold listings.')).toBeTruthy();
  });

  it('ignores an unknown status in the URL', async () => {
    const fetchMock = mockListingsApi([makeListing({ title: 'Anything' })]);
    renderApp('/?status=bogus');
    await screen.findByRole('listitem', { name: 'Anything' });
    expect(callsTo(fetchMock, 'GET /api/me/listings')[0]!.url.searchParams.has('status')).toBe(false);
  });

  it('pauses and reactivates a listing', async () => {
    const listing = makeListing({ title: 'Camera' });
    const fetchMock = mockListingsApi([listing]);
    renderApp('/');
    await screen.findByRole('listitem', { name: 'Camera' });

    await userEvent.click(row('Camera').getByRole('button', { name: 'Pause' }));
    expect(await row('Camera').findByText('Paused')).toBeTruthy();
    expect(callsTo(fetchMock, `PATCH /api/listings/${listing.id}/status`)[0]!.body).toEqual({
      status: 'paused',
    });

    await userEvent.click(row('Camera').getByRole('button', { name: 'Activate' }));
    expect(await row('Camera').findByText('Active')).toBeTruthy();
  });

  it('asks before marking as sold', async () => {
    const listing = makeListing({ title: 'Guitar' });
    const fetchMock = mockListingsApi([listing]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderApp('/');
    await screen.findByRole('listitem', { name: 'Guitar' });

    await userEvent.click(row('Guitar').getByRole('button', { name: 'Mark as sold' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(callsTo(fetchMock, `PATCH /api/listings/${listing.id}/status`)).toHaveLength(0);

    await userEvent.click(row('Guitar').getByRole('button', { name: 'Mark as sold' }));
    expect(await row('Guitar').findByText('Sold')).toBeTruthy();
    expect(
      row('Guitar')
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Delete']);
  });

  it('deletes a listing after confirmation', async () => {
    const listing = makeListing({ title: 'Lamp' });
    const fetchMock = mockListingsApi([listing, makeListing({ title: 'Desk' })]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/');
    await screen.findByRole('listitem', { name: 'Lamp' });

    await userEvent.click(row('Lamp').getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Lamp' })).toBeNull());
    expect(screen.getByRole('listitem', { name: 'Desk' })).toBeTruthy();
    expect(callsTo(fetchMock, `DELETE /api/listings/${listing.id}`)).toHaveLength(1);
  });

  it('shows the error when a status change is rejected', async () => {
    const listing = makeListing({ title: 'Stale' });
    mockApi({
      ...signedInHandlers,
      'GET /api/me/listings': { body: page([listing]) },
      [`PATCH /api/listings/${listing.id}/status`]: {
        status: 409,
        body: { error: 'Cannot change status from sold to paused' },
      },
    });
    renderApp('/');
    await screen.findByRole('listitem', { name: 'Stale' });
    await userEvent.click(row('Stale').getByRole('button', { name: 'Pause' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Cannot change status from sold to paused');
  });

  it('pages through listings', async () => {
    const fetchMock = mockApi({
      ...signedInHandlers,
      'GET /api/me/listings': ({ url }) => {
        const n = Number(url.searchParams.get('page') ?? 1);
        return { body: page([makeListing({ title: `On page ${n}` })], { page: n, pageSize: 20, total: 45 }) };
      },
    });
    const router = renderApp('/');
    await screen.findByText('Page 1 of 3');
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('listitem', { name: 'On page 2' })).toBeTruthy();
    expect(router.state.location.search).toBe('?page=2');
    expect(callsTo(fetchMock, 'GET /api/me/listings').at(-1)!.url.searchParams.get('pageSize')).toBe('20');
  });

  it('shows an empty state', async () => {
    mockApi(signedInHandlers);
    renderApp('/');
    expect(await screen.findByText('You have no listings yet.')).toBeTruthy();
  });

  it('returns to sign-in when the session expires', async () => {
    mockApi({ ...signedInHandlers, 'GET /api/me/listings': unauthorized });
    const router = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/login');
  });
});
