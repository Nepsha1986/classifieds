import { isPhotoMimeType, PHOTO_MAX_BYTES, PHOTO_MAX_PER_LISTING } from '@classifieds/shared';

const MAX_MB = PHOTO_MAX_BYTES / (1024 * 1024);

/**
 * Checks picked files against the shared upload limits before anything is sent. Files of the wrong
 * type or size are skipped with a message; a selection that would exceed the per-listing limit is
 * rejected as a whole, so the user decides which photos to keep. The API re-checks everything
 * (including the real format from the file's bytes).
 */
export function checkPhotoFiles(files: readonly File[], existingCount: number) {
  const errors: string[] = [];
  const accepted: File[] = [];
  for (const file of files) {
    if (!isPhotoMimeType(file.type)) errors.push(`${file.name}: only JPEG, PNG or WebP images`);
    else if (file.size > PHOTO_MAX_BYTES) errors.push(`${file.name}: larger than ${MAX_MB} MB`);
    else accepted.push(file);
  }
  const room = PHOTO_MAX_PER_LISTING - existingCount;
  if (accepted.length > room) {
    errors.push(
      room > 0
        ? `You can add ${room} more photo${room === 1 ? '' : 's'} (at most ${PHOTO_MAX_PER_LISTING} per listing).`
        : `This listing already has ${PHOTO_MAX_PER_LISTING} photos.`,
    );
    return { accepted: [], errors };
  }
  return { accepted, errors };
}

/** Moves the item at `from` to `to`, returning a new array. */
export function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
