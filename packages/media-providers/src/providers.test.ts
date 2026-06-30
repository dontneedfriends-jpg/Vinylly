import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from './cache';
import { DiscogsProvider } from './discogs';
import { MusicBrainzProvider } from './musicbrainz';
import { getHostShell, setHostShell } from '@vinylly/host';
import type { HostNet, HostShell } from '@vinylly/host';

function makeShell(impl: {
  fetchJson: HostNet['fetchJson'];
  fetchBinary: HostNet['fetchBinary'];
}): HostShell {
  return {
    paths: () => ({
      dataDir: '.',
      coversDir: 'covers',
      cacheDir: 'cache',
      dbFile: 'db.sqlite',
    }),
    fs: () => ({
      readText: async () => '',
      writeText: async () => {},
      readBinary: async () => new Uint8Array(),
      writeBinary: async () => {},
      exists: async () => false,
      ensureDir: async () => {},
      remove: async () => {},
      list: async () => [],
      join: (...parts) => parts.join('/'),
    }),
    net: () => impl,
    isPortable: () => true,
    platform: () => 'web',
  };
}

describe('DiscogsProvider', () => {
  beforeEach(() => {
    clearCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isEnabled only with token', () => {
    expect(new DiscogsProvider({ token: '', userAgent: 'x' }).isEnabled()).toBe(false);
    expect(new DiscogsProvider({ token: 'abc', userAgent: 'x' }).isEnabled()).toBe(true);
  });

  it('search sends format param when mediaType is provided', async () => {
    let captured = '';
    setHostShell(
      makeShell({
        fetchJson: <T>(url: string) => {
          captured = url;
          return Promise.resolve({ results: [] } as T);
        },
        fetchBinary: async () => new Uint8Array(),
      }),
    );
    const p = new DiscogsProvider({ token: 'tok', userAgent: 'x' });
    await p.search({ text: 'test', mediaType: 'Vinyl' });
    expect(captured).toContain('format=Vinyl');
  });

  it('search maps results to NormalizedRelease', async () => {
    setHostShell(
      makeShell({
        fetchJson: <T>(_url: string) =>
          Promise.resolve({
            results: [
              {
                id: 1,
                title: 'Pink Floyd - The Wall',
                year: 1979,
                genre: ['Rock'],
                style: ['Prog Rock'],
                cover_image: 'https://x/c.jpg',
                thumb: 'https://x/t.jpg',
              },
            ],
          } as T),
        fetchBinary: async () => new Uint8Array(),
      }),
    );
    const p = new DiscogsProvider({ token: 'tok', userAgent: 'vinylly/0.1' });
    const r = await p.search({ text: 'wall' });
    expect(r).toHaveLength(1);
    expect(r[0]?.release.artist).toBe('Pink Floyd');
    expect(r[0]?.release.title).toBe('Pink Floyd - The Wall');
    expect(r[0]?.release.genres).toEqual(['Rock']);
  });
});

describe('MusicBrainzProvider', () => {
  beforeEach(() => {
    clearCache();
  });

  it('isEnabled by default', () => {
    expect(new MusicBrainzProvider().isEnabled()).toBe(true);
  });

  it('search by text', async () => {
    setHostShell(
      makeShell({
        fetchJson: <T>(_url: string) =>
          Promise.resolve({
            releases: [
              {
                id: 'mbid-1',
                title: 'OK Computer',
                'artist-credit': [{ name: 'Radiohead' }],
                date: '1997-05-21',
              },
            ],
          } as T),
        fetchBinary: async () => new Uint8Array(),
      }),
    );
    const p = new MusicBrainzProvider();
    const r = await p.search({ text: 'radiohead' });
    expect(r[0]?.release.artist).toBe('Radiohead');
    expect(r[0]?.release.year).toBe(1997);
    expect(r[0]?.release.coverUrl).toContain('coverartarchive.org/release/mbid-1/front-500');
  });

  it('getRelease handles cover fetch gracefully', async () => {
    let count = 0;
    setHostShell(
      makeShell({
        fetchJson: <T>(url: string) => {
          count += 1;
          if (url.includes('coverartarchive')) {
            return Promise.reject(new Error('caa 404')) as Promise<T>;
          }
          return Promise.resolve({
            id: 'mbid-1',
            title: 'OK Computer',
            'artist-credit': [{ name: 'Radiohead' }],
            date: '1997-05-21',
            media: [{ tracks: [{ position: '1', title: 'Airbag', length: 285000 }] }],
          } as T);
        },
        fetchBinary: async () => new Uint8Array(),
      }),
    );
    const p = new MusicBrainzProvider();
    const r = await p.getRelease('mbid-1');
    expect(r?.title).toBe('OK Computer');
    expect(r?.tracklist[0]?.title).toBe('Airbag');
    expect(r?.coverUrl).toBe('https://coverartarchive.org/release/mbid-1/front-500');
    expect(count).toBe(1);
    expect(getHostShell().platform()).toBe('web');
  });
});
