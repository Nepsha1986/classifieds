import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callsTo, makeListing, mockApi, renderApp, signedInHandlers } from '../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillForm(values: { title?: string; description?: string; price?: string; city?: string }) {
  if (values.title !== undefined) await userEvent.type(screen.getByLabelText('Title'), values.title);
  if (values.description !== undefined)
    await userEvent.type(screen.getByLabelText('Description'), values.description);
  if (values.price !== undefined) await userEvent.type(screen.getByLabelText('Price'), values.price);
  if (values.city !== undefined) {
    await userEvent.clear(screen.getByLabelText('City'));
    await userEvent.type(screen.getByLabelText('City'), values.city);
  }
}

describe('new listing page', () => {
  it('validates with the shared rules before sending', async () => {
    const fetchMock = mockApi(signedInHandlers);
    renderApp('/listings/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Publish listing' }));
    // The option and the error share the text; the error is the alert.
    expect(await screen.findByText('Choose a category', { selector: '[role=alert]' })).toBeTruthy();
    expect(screen.getByText('Title must be at least 3 characters')).toBeTruthy();
    expect(callsTo(fetchMock, 'POST /api/listings')).toHaveLength(0);
  });

  it('creates a listing and continues on its edit page', async () => {
    const created = makeListing({ title: 'Road bike', price: 1_250_050, categoryId: 2 });
    const fetchMock = mockApi({
      ...signedInHandlers,
      'POST /api/listings': { status: 201, body: created },
      [`GET /api/listings/${created.id}`]: { body: created },
    });
    const router = renderApp('/listings/new');

    // The city defaults to the profile's city.
    expect(await screen.findByDisplayValue('Kyiv')).toBeTruthy();
    await fillForm({ title: 'Road bike', description: 'Fast and light', price: '12 500,50', city: 'Lviv' });
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Cars');
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await userEvent.click(screen.getByRole('button', { name: 'Publish listing' }));

    expect(await screen.findByText(/Listing published/)).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/listings/${created.id}/edit`);
    expect(callsTo(fetchMock, 'POST /api/listings')[0]!.body).toEqual({
      title: 'Road bike',
      description: 'Fast and light',
      price: 1_250_050,
      currency: 'USD',
      city: 'Lviv',
      categoryId: 2,
      attributes: {},
    });
  });

  it('shows field errors returned by the API', async () => {
    mockApi({
      ...signedInHandlers,
      'POST /api/listings': {
        status: 400,
        body: {
          error: 'Category must be a leaf category',
          details: { fieldErrors: { categoryId: ['Pick a leaf'] } },
        },
      },
    });
    renderApp('/listings/new');
    await screen.findByLabelText('Title');
    await fillForm({ title: 'Road bike', description: 'Fast' });
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Phones');
    await userEvent.click(screen.getByRole('button', { name: 'Publish listing' }));
    expect(await screen.findByText('Pick a leaf')).toBeTruthy();
  });

  it('shows other API errors above the button', async () => {
    mockApi({
      ...signedInHandlers,
      'POST /api/listings': { status: 500, body: { error: 'Internal server error' } },
    });
    renderApp('/listings/new');
    await screen.findByLabelText('Title');
    await fillForm({ title: 'Road bike', description: 'Fast' });
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Phones');
    await userEvent.click(screen.getByRole('button', { name: 'Publish listing' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Internal server error');
  });
});

describe('edit listing page', () => {
  it('loads the listing into the form and saves changes', async () => {
    const listing = makeListing({
      title: 'Old title',
      price: 99_950,
      currency: 'EUR',
      categoryId: 5,
      attributes: { storage: 128 },
    });
    const fetchMock = mockApi({
      ...signedInHandlers,
      [`GET /api/listings/${listing.id}`]: { body: listing },
      [`PATCH /api/listings/${listing.id}`]: ({ body }) => ({ body: { ...listing, ...(body as object) } }),
    });
    const router = renderApp(`/listings/${listing.id}/edit`);

    expect(await screen.findByDisplayValue('Old title')).toBeTruthy();
    expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe('999.50');
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('EUR');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('5');

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'New title');
    await userEvent.clear(screen.getByLabelText('Price'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    // Attributes are left out so the API keeps them.
    expect(callsTo(fetchMock, `PATCH /api/listings/${listing.id}`)[0]!.body).toEqual({
      title: 'New title',
      description: listing.description,
      price: null,
      currency: 'EUR',
      city: 'Kyiv',
      categoryId: 5,
    });
  });

  it('keeps a sold listing read-only', async () => {
    const listing = makeListing({ title: 'Gone', status: 'sold' });
    mockApi({ ...signedInHandlers, [`GET /api/listings/${listing.id}`]: { body: listing } });
    renderApp(`/listings/${listing.id}/edit`);
    expect(await screen.findByText(/sold and can no longer be changed/)).toBeTruthy();
    const title = (await screen.findByLabelText('Title')) as HTMLInputElement;
    expect(title.closest('fieldset')!.disabled).toBe(true);
  });

  it('says when the listing does not exist', async () => {
    mockApi(signedInHandlers);
    renderApp('/listings/00000000-0000-4000-8000-999999999999/edit');
    expect(await screen.findByRole('heading', { name: 'Listing not found' })).toBeTruthy();
  });
});
