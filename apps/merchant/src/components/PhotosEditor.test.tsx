import { PHOTO_UPLOAD_FIELD, type ListingPhoto } from '@classifieds/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callsTo, makeListing, mockApi, renderApp, signedInHandlers } from '../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const photo = (n: number): ListingPhoto => ({
  id: `20000000-0000-4000-8000-00000000000${n}`,
  url: `/uploads/listings/p${n}.png`,
  position: n - 1,
  createdAt: '2026-10-05T10:00:00.000Z',
});

const png = (name: string) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

function setup(photos: ListingPhoto[], status: 'active' | 'sold' = 'active') {
  const listing = makeListing({ title: 'Camera', photos, status });
  let current = [...photos];
  const fetchMock = mockApi({
    ...signedInHandlers,
    [`GET /api/listings/${listing.id}`]: () => ({ body: { ...listing, photos: current } }),
    [`POST /api/listings/${listing.id}/photos`]: ({ body }) => {
      const files = (body as FormData).getAll(PHOTO_UPLOAD_FIELD);
      current = [...current, ...files.map((_f, i) => photo(current.length + i + 1))];
      return { status: 201, body: current };
    },
    [`PUT /api/listings/${listing.id}/photos/order`]: ({ body }) => {
      const ids = (body as { photoIds: string[] }).photoIds;
      current = ids.map((id, position) => ({ ...current.find((p) => p.id === id)!, position }));
      return { body: current };
    },
    ...Object.fromEntries(
      [1, 2, 3, 4].map((n) => [
        `DELETE /api/listings/${listing.id}/photos/${photo(n).id}`,
        () => {
          current = current.filter((p) => p.id !== photo(n).id).map((p, position) => ({ ...p, position }));
          return { status: 204 };
        },
      ]),
    ),
  });
  renderApp(`/listings/${listing.id}/edit`);
  return { listing, fetchMock };
}

describe('photos on the edit page', () => {
  it('uploads picked images and shows them, the first as the cover', async () => {
    const { listing, fetchMock } = setup([]);
    expect(await screen.findByText(/No photos yet/)).toBeTruthy();

    await userEvent.upload(screen.getByLabelText('Add photos'), [png('a.png'), png('b.png')]);

    expect(await screen.findByRole('img', { name: 'Photo 2' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Photo 1' }).getAttribute('src')).toBe('/uploads/listings/p1.png');
    expect(within(screen.getByRole('listitem', { name: 'Photo 1' })).getByText('Cover')).toBeTruthy();
    expect(screen.getByText('2 of 10')).toBeTruthy();

    const sent = callsTo(fetchMock, `POST /api/listings/${listing.id}/photos`)[0]!.body as FormData;
    expect(sent.getAll(PHOTO_UPLOAD_FIELD).map((f) => (f as File).name)).toEqual(['a.png', 'b.png']);
  });

  it('refuses files the API would reject, without uploading them', async () => {
    const { listing, fetchMock } = setup([]);
    await screen.findByText(/No photos yet/);
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText('Add photos'), [
      new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }),
    ]);
    expect((await screen.findByRole('alert')).textContent).toBe('doc.pdf: only JPEG, PNG or WebP images');
    expect(callsTo(fetchMock, `POST /api/listings/${listing.id}/photos`)).toHaveLength(0);
  });

  it('reorders photos and changes the cover', async () => {
    const { listing, fetchMock } = setup([photo(1), photo(2), photo(3)]);
    await screen.findByRole('img', { name: 'Photo 3' });

    await userEvent.click(screen.getByRole('button', { name: 'Move photo 1 right' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Photo 1' }).getAttribute('src')).toBe(
        '/uploads/listings/p2.png',
      ),
    );
    expect(callsTo(fetchMock, `PUT /api/listings/${listing.id}/photos/order`)[0]!.body).toEqual({
      photoIds: [photo(2).id, photo(1).id, photo(3).id],
    });

    await userEvent.click(
      within(screen.getByRole('listitem', { name: 'Photo 3' })).getByRole('button', { name: 'Make cover' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Photo 1' }).getAttribute('src')).toBe(
        '/uploads/listings/p3.png',
      ),
    );
    expect(screen.getByRole('button', { name: 'Move photo 1 left' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Move photo 3 right' }).hasAttribute('disabled')).toBe(true);
  });

  it('removes a photo after confirmation', async () => {
    const { listing, fetchMock } = setup([photo(1), photo(2)]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await screen.findByRole('img', { name: 'Photo 2' });

    await userEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(callsTo(fetchMock, `DELETE /api/listings/${listing.id}/photos/${photo(1).id}`)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Photo 2' })).toBeNull());
    expect(screen.getByRole('img', { name: 'Photo 1' }).getAttribute('src')).toBe('/uploads/listings/p2.png');
    expect(screen.getByText('1 of 10')).toBeTruthy();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('shows the API error when an upload is refused', async () => {
    const listing = makeListing({ title: 'Camera' });
    mockApi({
      ...signedInHandlers,
      [`GET /api/listings/${listing.id}`]: { body: listing },
      [`POST /api/listings/${listing.id}/photos`]: {
        status: 415,
        body: { error: 'Only JPEG, PNG and WebP images are allowed' },
      },
    });
    renderApp(`/listings/${listing.id}/edit`);
    await userEvent.upload(await screen.findByLabelText('Add photos'), [png('fake.png')]);
    expect((await screen.findByRole('alert')).textContent).toBe('Only JPEG, PNG and WebP images are allowed');
  });

  it('shows photos of a sold listing without editing controls', async () => {
    setup([photo(1), photo(2)], 'sold');
    await screen.findByRole('img', { name: 'Photo 2' });
    expect(screen.queryByLabelText('Add photos')).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove photo/ })).toBeNull();
  });
});
