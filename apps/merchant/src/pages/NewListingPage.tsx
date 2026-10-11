import { useNavigate } from 'react-router';
import { useMe } from '../auth';
import { ListingForm } from '../components/ListingForm';
import { emptyListingForm } from '../listing-form';
import { useCreateListing } from '../queries';

export function NewListingPage() {
  const me = useMe();
  const navigate = useNavigate();
  const create = useCreateListing();

  return (
    <section className="narrow">
      <h1>New listing</h1>
      <ListingForm
        defaultValues={emptyListingForm(me.data?.city ?? '')}
        submitLabel="Publish listing"
        pendingLabel="Publishing…"
        onSubmit={async (input) => {
          const listing = await create.mutateAsync(input);
          // Photos are added to an existing listing, so continue on its edit page.
          navigate(`/listings/${listing.id}/edit`, { replace: true, state: { created: true } });
        }}
      />
    </section>
  );
}
