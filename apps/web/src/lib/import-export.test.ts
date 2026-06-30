import { describe, expect, it } from 'vitest';
import { bundleToCsv, buildBundle, parseBundle } from './import-export';
import type { ItemRecord, TrackRecord } from '@vinylly/db';

const item: ItemRecord = {
  id: 'itm_1',
  type: 'vinyl',
  barcode: '1234567890',
  catalogNumber: 'ABC-001',
  sleeveCondition: 'NM',
  mediaCondition: 'VG+',
  notes: 'note, with comma',
  acquiredAt: '2024-01-01T00:00:00.000Z',
  location: 'shelf A1',
  tags: ['jazz', 'demo'],
  release: {
    id: 'rel_1',
    source: 'discogs',
    sourceId: 'r-1',
    title: 'Album, Vol. 1',
    artist: 'Miles Davis',
    year: 1959,
    genres: ['Jazz'],
    styles: ['Modal'],
    coverPath: null,
    thumbPath: null,
    coverRemote: 'https://x/c.jpg',
    thumbRemote: null,
  },
};

const tracks: TrackRecord[] = [
  { id: 't1', position: 'A1', title: 'So What', duration: 565000, lyrics: null, lyricsSrc: null },
  {
    id: 't2',
    position: 'A2',
    title: 'Freddie',
    duration: 590000,
    lyrics: 'la la la',
    lyricsSrc: 'genius',
  },
];

describe('import-export', () => {
  it('builds and parses a bundle', () => {
    const map = new Map([[item.release.id, tracks]]);
    const bundle = buildBundle([item], map);
    expect(bundle.format).toBe('vinylly.v1');
    expect(bundle.items).toHaveLength(1);
    const round = parseBundle(JSON.stringify(bundle));
    expect(round.items[0]?.release.title).toBe('Album, Vol. 1');
    expect(round.items[0]?.tracklist[1]?.lyrics).toBe('la la la');
  });

  it('rejects invalid format', () => {
    expect(() => parseBundle('{"format":"other","items":[]}')).toThrow();
  });

  it('serializes to CSV with quotes around commas', () => {
    const map = new Map([[item.release.id, tracks]]);
    const csv = bundleToCsv(buildBundle([item], map));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('title,artist,year');
    expect(lines[1]).toContain('"Album, Vol. 1"');
    expect(lines[1]).toContain('"note, with comma"');
  });
});
