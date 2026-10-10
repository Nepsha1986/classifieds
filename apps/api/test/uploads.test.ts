import { describe, expect, it } from 'vitest';
import { detectImageTypeFromBytes } from '../src/lib/uploads.js';
import { pngBytes } from './helpers.js';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('detectImageTypeFromBytes', () => {
  it.each([
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/png', pngBytes()],
    ['image/webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')],
  ])('detects %s', (type, input) => {
    expect(detectImageTypeFromBytes(input)).toBe(type);
  });

  it.each([
    ['empty input', bytes()],
    ['text', Buffer.from('hello world!')],
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ['GIF', Buffer.from('GIF89a......')],
    ['a RIFF file that is not WebP (WAV)', Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'latin1')],
    ['a truncated PNG signature', bytes(0x89, 0x50, 0x4e, 0x47)],
  ])('rejects %s', (_name, input) => {
    expect(detectImageTypeFromBytes(input)).toBeUndefined();
  });
});
