import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicApiUrl, publicAssetUrl, serverApiUrl } from './config';

afterEach(() => vi.unstubAllEnvs());

describe('API URLs', () => {
  it('default to the local API', () => {
    vi.stubEnv('API_URL', '');
    vi.stubEnv('PUBLIC_API_URL', '');
    expect(serverApiUrl()).toBe('http://localhost:4000');
    expect(publicApiUrl()).toBe('http://localhost:4000');
  });

  it('use a separate public URL for the browser', () => {
    vi.stubEnv('API_URL', 'http://api:4000');
    vi.stubEnv('PUBLIC_API_URL', 'https://api.example.com/');
    expect(serverApiUrl()).toBe('http://api:4000');
    expect(publicAssetUrl('/uploads/listings/a.png')).toBe('https://api.example.com/uploads/listings/a.png');
  });
});
