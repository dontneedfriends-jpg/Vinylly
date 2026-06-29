import { describe, expect, it } from 'vitest';
import { collectionRepo, itemRepo, trackRepo } from '../src';

describe('collectionRepo', () => {
  it('ensures default collection', async () => {
    const a = await collectionRepo.ensureDefault();
    const b = await collectionRepo.ensureDefault();
    expect(a.id).toBe(b.id);
    expect(a.name).toBe('Моя коллекция');
  });
});

describe('itemRepo', () => {
  it('creates item with release and tracks', async () => {
    const col = await collectionRepo.ensureDefault();
    const created = await itemRepo.create({
      collectionId: col.id,
      type: 'vinyl',
      release: {
        source: 'discogs',
        sourceId: 'r-1',
        title: 'Test Album',
        artist: 'Test Artist',
        year: 2024,
        genres: ['Rock'],
        styles: ['Indie'],
      },
      tracklist: [
        { position: 'A1', title: 'Track One', duration: 180000 },
        { position: 'A2', title: 'Track Two', duration: 200000 },
      ],
      tags: ['test', 'demo'],
    });
    expect(created.id).toBeTruthy();
    expect(created.type).toBe('vinyl');
    expect(created.release.title).toBe('Test Album');
    expect(created.release.genres).toEqual(['Rock']);
    expect(created.tags).toEqual(['test', 'demo']);
    const tracks = await trackRepo.listByRelease(created.release.id);
    expect(tracks).toHaveLength(2);
    expect(tracks[0]?.position).toBe('A1');
    expect(tracks[0]?.duration).toBe(180000);
  });

  it('deduplicates release by source+sourceId', async () => {
    const col = await collectionRepo.ensureDefault();
    await itemRepo.create({
      collectionId: col.id,
      type: 'vinyl',
      release: { source: 'discogs', sourceId: 'dup', title: 'A', artist: 'B', year: null },
    });
    await itemRepo.create({
      collectionId: col.id,
      type: 'cd',
      release: { source: 'discogs', sourceId: 'dup', title: 'A (CD)', artist: 'B', year: null },
    });
    const all = await itemRepo.list();
    expect(all).toHaveLength(2);
  });

  it('lists with filter and sort', async () => {
    const col = await collectionRepo.ensureDefault();
    const a = await itemRepo.create({
      collectionId: col.id,
      type: 'vinyl',
      release: { source: 'manual', sourceId: 'm-a', title: 'Alpha', artist: 'Z', year: 1990 },
    });
    const b = await itemRepo.create({
      collectionId: col.id,
      type: 'cd',
      release: { source: 'manual', sourceId: 'm-b', title: 'Bravo', artist: 'Y', year: 2000 },
    });
    const byTitle = await itemRepo.list({ sort: 'titleAsc' });
    expect(byTitle[0]?.id).toBe(a.id);
    expect(byTitle[1]?.id).toBe(b.id);

    const byYear = await itemRepo.list({ sort: 'yearDesc' });
    expect(byYear[0]?.id).toBe(b.id);

    const vinylOnly = await itemRepo.list({ type: 'vinyl' });
    expect(vinylOnly).toHaveLength(1);
    expect(vinylOnly[0]?.id).toBe(a.id);

    const bySearch = await itemRepo.list({ search: 'alp' });
    expect(bySearch).toHaveLength(1);
  });

  it('updates and removes', async () => {
    const col = await collectionRepo.ensureDefault();
    const item = await itemRepo.create({
      collectionId: col.id,
      type: 'vinyl',
      release: { source: 'manual', sourceId: 'm-1', title: 'X', artist: 'Y', year: null },
      notes: 'old',
    });
    const updated = await itemRepo.update(item.id, { notes: 'new', location: 'shelf' });
    expect(updated.notes).toBe('new');
    expect(updated.location).toBe('shelf');
    await itemRepo.remove(item.id);
    const all = await itemRepo.list();
    expect(all).toHaveLength(0);
  });

  it('sets release cover paths', async () => {
    const col = await collectionRepo.ensureDefault();
    const item = await itemRepo.create({
      collectionId: col.id,
      type: 'vinyl',
      release: { source: 'manual', sourceId: 'm-c', title: 'C', artist: 'A', year: null },
    });
    await itemRepo.setReleaseCover(item.release.id, {
      coverPath: 'covers/x.jpg',
      thumbPath: 'covers/x_thumb.jpg',
      coverRemote: 'https://example/x.jpg',
      thumbRemote: 'https://example/x_thumb.jpg',
    });
    const fetched = await itemRepo.get(item.id);
    expect(fetched?.release.coverPath).toBe('covers/x.jpg');
    expect(fetched?.release.coverRemote).toBe('https://example/x.jpg');
  });
});

describe('trackRepo', () => {
  it('sets lyrics and source', async () => {
    const col = await collectionRepo.ensureDefault();
    const item = await itemRepo.create({
      collectionId: col.id,
      type: 'vinyl',
      release: { source: 'manual', sourceId: 't-1', title: 'T', artist: 'A', year: null },
      tracklist: [{ position: '1', title: 'Only', duration: 1000 }],
    });
    const tracks = await trackRepo.listByRelease(item.release.id);
    const first = tracks[0];
    expect(first).toBeDefined();
    if (!first) return;
    await trackRepo.setLyrics(first.id, 'la la la', 'genius');
    const reloaded = await trackRepo.get(first.id);
    expect(reloaded?.lyrics).toBe('la la la');
    expect(reloaded?.lyricsSrc).toBe('genius');
  });
});
