import { PHOTO_MAX_PER_LISTING, PHOTO_MIME_TYPES, type ListingPhoto } from '@classifieds/shared';
import { useRef, useState } from 'react';
import { apiUrl } from '../api/client';
import { checkPhotoFiles, move } from '../photo-files';
import { useDeletePhoto, useReorderPhotos, useUploadPhotos } from '../queries';
import { FormError } from './form';

type Props = { listingId: string; photos: ListingPhoto[]; readOnly?: boolean };

/** Photos of a listing: upload, remove and reorder; the first photo is the cover. */
export function PhotosEditor({ listingId, photos, readOnly = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const upload = useUploadPhotos(listingId);
  const reorder = useReorderPhotos(listingId);
  const remove = useDeletePhoto(listingId);
  const busy = upload.isPending || reorder.isPending || remove.isPending;
  const full = photos.length >= PHOTO_MAX_PER_LISTING;

  const resetErrors = () => {
    setFileErrors([]);
    upload.reset();
    reorder.reset();
    remove.reset();
  };

  const onFilesPicked = (files: FileList | null) => {
    resetErrors();
    const { accepted, errors } = checkPhotoFiles(Array.from(files ?? []), photos.length);
    setFileErrors(errors);
    if (accepted.length > 0) upload.mutate(accepted);
    // Allow picking the same file again after an error.
    if (inputRef.current) inputRef.current.value = '';
  };

  const onMove = (from: number, to: number) => {
    resetErrors();
    reorder.mutate(move(photos, from, to).map((p) => p.id));
  };

  const onRemove = (photo: ListingPhoto, index: number) => {
    if (!window.confirm(`Remove photo ${index + 1}?`)) return;
    resetErrors();
    remove.mutate(photo.id);
  };

  return (
    <section className="photos" aria-labelledby="photos-heading" aria-busy={busy}>
      <div className="page-header">
        <h2 id="photos-heading">Photos</h2>
        <span className="muted small">
          {photos.length} of {PHOTO_MAX_PER_LISTING}
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="muted">No photos yet. The first photo becomes the cover.</p>
      ) : (
        <ol className="photo-grid">
          {photos.map((photo, index) => (
            <li key={photo.id} className="photo-item" aria-label={`Photo ${index + 1}`}>
              <img src={apiUrl(photo.url)} alt={`Photo ${index + 1}`} />
              {index === 0 && <span className="cover-label">Cover</span>}
              {!readOnly && (
                <div className="photo-actions">
                  {index > 0 && (
                    <button
                      type="button"
                      className="button small"
                      disabled={busy}
                      onClick={() => onMove(index, 0)}
                    >
                      Make cover
                    </button>
                  )}
                  <button
                    type="button"
                    className="button small"
                    disabled={busy || index === 0}
                    onClick={() => onMove(index, index - 1)}
                    aria-label={`Move photo ${index + 1} left`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="button small"
                    disabled={busy || index === photos.length - 1}
                    onClick={() => onMove(index, index + 1)}
                    aria-label={`Move photo ${index + 1} right`}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className="button small danger"
                    disabled={busy}
                    onClick={() => onRemove(photo, index)}
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!readOnly && (
        <div className="photo-upload">
          <label className={`button${busy || full ? ' disabled' : ''}`}>
            {upload.isPending ? 'Uploading…' : 'Add photos'}
            <input
              ref={inputRef}
              type="file"
              className="visually-hidden"
              accept={PHOTO_MIME_TYPES.join(',')}
              multiple
              disabled={busy || full}
              onChange={(event) => onFilesPicked(event.target.files)}
            />
          </label>
          <span className="muted small">JPEG, PNG or WebP, up to 5 MB each.</span>
        </div>
      )}

      {fileErrors.length > 0 && (
        <ul className="error file-errors" role="alert">
          {fileErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <FormError error={upload.error ?? reorder.error ?? remove.error} />
    </section>
  );
}
