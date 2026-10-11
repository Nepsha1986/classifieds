import { PHOTO_MAX_BYTES, PHOTO_MAX_PER_LISTING } from '@classifieds/shared';
import { describe, expect, it } from 'vitest';
import { checkPhotoFiles, move } from './photo-files';

const file = (name: string, type = 'image/png', size = 1000) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('checkPhotoFiles', () => {
  it('accepts images within the limits', () => {
    const files = [file('a.png'), file('b.jpg', 'image/jpeg'), file('c.webp', 'image/webp', PHOTO_MAX_BYTES)];
    expect(checkPhotoFiles(files, 0)).toEqual({ accepted: files, errors: [] });
  });

  it('skips files of the wrong type or size with a message', () => {
    const ok = file('ok.png');
    const result = checkPhotoFiles(
      [file('doc.pdf', 'application/pdf'), file('big.png', 'image/png', PHOTO_MAX_BYTES + 1), ok],
      0,
    );
    expect(result.accepted).toEqual([ok]);
    expect(result.errors).toEqual(['doc.pdf: only JPEG, PNG or WebP images', 'big.png: larger than 5 MB']);
  });

  it('rejects a selection that would exceed the per-listing limit', () => {
    const result = checkPhotoFiles([file('a.png'), file('b.png')], PHOTO_MAX_PER_LISTING - 1);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual(['You can add 1 more photo (at most 10 per listing).']);
    expect(checkPhotoFiles([file('a.png')], PHOTO_MAX_PER_LISTING).errors).toEqual([
      'This listing already has 10 photos.',
    ]);
  });
});

describe('move', () => {
  it('moves an item to a new index', () => {
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });
});
