import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { FormError } from '../components/form';
import { ListingForm } from '../components/ListingForm';
import { StatusBadge } from '../components/StatusBadge';
import { listingToForm } from '../listing-form';
import { useListing, useUpdateListing } from '../queries';

export function EditListingPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const listing = useListing(id);
  const update = useUpdateListing(id);
  const created = (location.state as { created?: boolean } | null)?.created === true;

  if (listing.isPending) return <p className="muted">Loading…</p>;
  if (listing.isError) {
    const status = listing.error instanceof ApiError ? listing.error.status : 0;
    return (
      <section className="narrow">
        <h1>{status === 404 ? 'Listing not found' : 'Could not load the listing'}</h1>
        {status !== 404 && <FormError error={listing.error} />}
        <p>
          <Link to="/">Back to my listings</Link>
        </p>
      </section>
    );
  }

  const data = listing.data;
  const sold = data.status === 'sold';

  return (
    <section className="narrow">
      <div className="page-header">
        <h1>Edit listing</h1>
        <StatusBadge status={data.status} />
      </div>
      {created && <p className="notice">Listing published. You can add photos below.</p>}
      {sold && <p className="notice">This listing is sold and can no longer be changed.</p>}
      <ListingForm
        // Re-create the form when another listing is opened.
        key={data.id}
        defaultValues={listingToForm(data)}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        disabled={sold}
        onSubmit={async (input) => {
          // Attributes are not edited here; leaving them out of the PATCH keeps them as they are.
          const { attributes: _attributes, ...fields } = input;
          await update.mutateAsync(fields);
          navigate('/');
        }}
      />
    </section>
  );
}
