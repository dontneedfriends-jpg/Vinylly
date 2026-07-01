import {
  getPrismaClient,
  type ItemRecord,
  type MediaType,
  type ReleaseRecord,
  type ReleaseImage,
  type TrackRecord,
} from './index';

export interface CreateItemInput {
  collectionId: string;
  type: MediaType;
  release: {
    source: ReleaseRecord['source'];
    sourceId: string;
    title: string;
    artist: string;
    year: number | null;
    genres?: string[];
    styles?: string[];
    coverPath?: string | null;
    thumbPath?: string | null;
    coverRemote?: string | null;
    thumbRemote?: string | null;
    images?: ReleaseImage[];
  };
  tracklist?: Array<{ position: string; title: string; duration?: number | null }>;
  barcode?: string | null;
  catalogNumber?: string | null;
  sleeveCondition?: string | null;
  mediaCondition?: string | null;
  notes?: string | null;
  location?: string | null;
  tags?: string[];
  acquiredAt?: string | null;
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface CollectionRepository {
  ensureDefault(): Promise<{ id: string; name: string }>;
}

export const collectionRepo: CollectionRepository = {
  async ensureDefault() {
    const prisma = getPrismaClient();
    const existing = (await prisma.collection.findFirst({})) as { id: string; name: string } | null;
    if (existing) return existing;
    return (await prisma.collection.create({
      data: { id: genId('col'), name: 'Моя коллекция' },
    })) as { id: string; name: string };
  },
};

export interface ItemListFilter {
  collectionId?: string;
  type?: MediaType;
  search?: string;
  tags?: string[];
  sort?: 'addedDesc' | 'addedAsc' | 'titleAsc' | 'artistAsc' | 'yearDesc';
}

export interface ItemRepository {
  list(filter?: ItemListFilter): Promise<ItemRecord[]>;
  get(id: string): Promise<ItemRecord | null>;
  create(input: CreateItemInput): Promise<ItemRecord>;
  update(id: string, patch: Partial<CreateItemInput>): Promise<ItemRecord>;
  remove(id: string): Promise<void>;
  findBySource(source: string, sourceId: string): Promise<ItemRecord | null>;
  setReleaseCover(
    releaseId: string,
    cover: { coverPath: string | null; thumbPath: string | null; coverRemote: string; thumbRemote: string | null },
  ): Promise<void>;
  setReleaseImages(releaseId: string, images: ReleaseImage[]): Promise<void>;
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[] = []): T[] {
  if (!value) return fallback;
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function serializeTracks(
  releaseId: string,
  tracklist: Array<{ position: string; title: string; duration?: number | null }>,
): Array<Record<string, unknown>> {
  return tracklist.map((t) => ({
    id: genId('trk'),
    releaseId,
    position: t.position,
    title: t.title,
    duration: t.duration ?? null,
    lyrics: null,
    lyricsSrc: null,
    extras: '{}',
  }));
}

export const itemRepo: ItemRepository = {
  async list(filter = {}) {
    const prisma = getPrismaClient() as unknown as {
      item: { findMany: (a: unknown) => Promise<Array<Record<string, unknown>>> };
    };
    const where: Record<string, unknown> = {};
    if (filter.collectionId) where.collectionId = filter.collectionId;
    if (filter.type) where.type = filter.type;
    const rows = await prisma.item.findMany({
      where,
      include: { release: true },
      orderBy: { createdAt: 'desc' },
    });
    let mapped: ItemRecord[] = rows.map(itemFromRow);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      mapped = mapped.filter(
        (it) =>
          it.release.title.toLowerCase().includes(q) || it.release.artist.toLowerCase().includes(q),
      );
    }
    if (filter.tags?.length) {
      mapped = mapped.filter((it) =>
        filter.tags!.every((t) => (it.tags ?? []).includes(t)),
      );
    }
    return sortItems(mapped, filter.sort ?? 'addedDesc');
  },

  async get(id) {
    const prisma = getPrismaClient() as unknown as {
      item: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> };
    };
    const row = await prisma.item.findUnique({ where: { id }, include: { release: true } });
    return row ? itemFromRow(row) : null;
  },

  async create(input) {
    const prisma = getPrismaClient() as unknown as {
      release: {
        upsert: (a: unknown) => Promise<{ id: string }>;
        findUnique: (a: unknown) => Promise<{ id: string } | null>;
      };
      track: { createMany: (a: unknown) => Promise<unknown> };
      item: { create: (a: unknown) => Promise<Record<string, unknown>> };
    };
    const candidateId = genId('rel');
    const releaseRow = {
      id: candidateId,
      source: input.release.source,
      sourceId: input.release.sourceId,
      title: input.release.title,
      artist: input.release.artist,
      year: input.release.year,
      genres: JSON.stringify(input.release.genres ?? []),
      styles: JSON.stringify(input.release.styles ?? []),
      coverPath: input.release.coverPath ?? null,
      thumbPath: input.release.thumbPath ?? null,
      coverRemote: input.release.coverRemote ?? null,
      thumbRemote: input.release.thumbRemote ?? null,
      images: JSON.stringify(input.release.images ?? []),
      createdAt: new Date(nowIso()),
      updatedAt: new Date(nowIso()),
    };
    await prisma.release.upsert({
      where: { source_sourceId: { source: releaseRow.source, sourceId: releaseRow.sourceId } },
      create: releaseRow,
      update: {
        title: releaseRow.title,
        artist: releaseRow.artist,
        year: releaseRow.year,
        coverPath: releaseRow.coverPath,
        thumbPath: releaseRow.thumbPath,
        coverRemote: releaseRow.coverRemote,
        thumbRemote: releaseRow.thumbRemote,
        images: releaseRow.images,
      },
    });
    const existing = await prisma.release.findUnique({
      where: { source_sourceId: { source: releaseRow.source, sourceId: releaseRow.sourceId } },
    });
    const releaseId = existing?.id ?? candidateId;
    const tracklist = input.tracklist ?? [];
    if (tracklist.length) {
      await prisma.track.createMany({ data: serializeTracks(releaseId, tracklist) });
    }
    const itemId = genId('itm');
    const created = await prisma.item.create({
      data: {
        id: itemId,
        type: input.type,
        barcode: input.barcode ?? null,
        catalogNumber: input.catalogNumber ?? null,
        sleeveCondition: input.sleeveCondition ?? null,
        mediaCondition: input.mediaCondition ?? null,
        notes: input.notes ?? null,
        location: input.location ?? null,
        tags: JSON.stringify(input.tags ?? []),
        acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : null,
        collectionId: input.collectionId,
        releaseId,
      },
      include: { release: true },
    });
    return itemFromRow(created);
  },

  async update(id, patch) {
    const prisma = getPrismaClient() as unknown as {
      item: {
        findUnique: (a: unknown) => Promise<Record<string, unknown> | null>;
        update: (a: unknown) => Promise<Record<string, unknown>>;
      };
    };
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) throw new Error(`Item not found: ${id}`);
    const data: Record<string, unknown> = {};
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.barcode !== undefined) data.barcode = patch.barcode;
    if (patch.catalogNumber !== undefined) data.catalogNumber = patch.catalogNumber;
    if (patch.sleeveCondition !== undefined) data.sleeveCondition = patch.sleeveCondition;
    if (patch.mediaCondition !== undefined) data.mediaCondition = patch.mediaCondition;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.location !== undefined) data.location = patch.location;
    if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
    if (patch.acquiredAt !== undefined)
      data.acquiredAt = patch.acquiredAt ? new Date(patch.acquiredAt) : null;
    const updated = await prisma.item.update({
      where: { id },
      data,
      include: { release: true },
    });
    return itemFromRow(updated);
  },

  async remove(id) {
    const prisma = getPrismaClient();
    await prisma.item.delete({ where: { id } });
  },

  async findBySource(source, sourceId) {
    const prisma = getPrismaClient() as unknown as {
      item: { findFirst: (a: unknown) => Promise<Record<string, unknown> | null> };
    };
    const row = await prisma.item.findFirst({
      where: { release: { source, sourceId } },
      include: { release: true },
    });
    return row ? itemFromRow(row) : null;
  },

  async setReleaseCover(releaseId, cover) {
    const prisma = getPrismaClient() as unknown as {
      release: { update: (a: unknown) => Promise<unknown> };
    };
    await prisma.release.update({
      where: { id: releaseId },
      data: {
        coverPath: cover.coverPath,
        thumbPath: cover.thumbPath,
        coverRemote: cover.coverRemote,
        thumbRemote: cover.thumbRemote,
      },
    });
  },

  async setReleaseImages(releaseId, images) {
    const prisma = getPrismaClient() as unknown as {
      release: { update: (a: unknown) => Promise<unknown> };
    };
    await prisma.release.update({
      where: { id: releaseId },
      data: { images: JSON.stringify(images) },
    });
  },
};

function sortItems(items: ItemRecord[], sort: NonNullable<ItemListFilter['sort']>): ItemRecord[] {
  const sorted = [...items];
  switch (sort) {
    case 'addedDesc':
      return sorted;
    case 'addedAsc':
      return sorted.reverse();
    case 'titleAsc':
      sorted.sort((a, b) => a.release.title.localeCompare(b.release.title, 'ru'));
      return sorted;
    case 'artistAsc':
      sorted.sort((a, b) => a.release.artist.localeCompare(b.release.artist, 'ru'));
      return sorted;
    case 'yearDesc':
      sorted.sort((a, b) => (b.release.year ?? 0) - (a.release.year ?? 0));
      return sorted;
  }
}

function itemFromRow(row: Record<string, unknown>): ItemRecord {
  const release = (row.release as Record<string, unknown> | undefined) ?? {};
  return {
    id: String(row.id),
    type: row.type as MediaType,
    barcode: (row.barcode as string | null) ?? null,
    catalogNumber: (row.catalogNumber as string | null) ?? null,
    sleeveCondition: (row.sleeveCondition as string | null) ?? null,
    mediaCondition: (row.mediaCondition as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    acquiredAt: row.acquiredAt ? new Date(row.acquiredAt as string).toISOString() : null,
    location: (row.location as string | null) ?? null,
    tags: parseJsonArray<string>(row.tags as string | undefined, []),
    release: {
      id: String(release.id ?? row.releaseId),
      source: (release.source as ReleaseRecord['source']) ?? 'manual',
      sourceId: String(release.sourceId ?? ''),
      title: String(release.title ?? '—'),
      artist: String(release.artist ?? '—'),
      year: (release.year as number | null) ?? null,
      genres: parseJsonArray<string>(release.genres as string | undefined, []),
      styles: parseJsonArray<string>(release.styles as string | undefined, []),
      coverPath: (release.coverPath as string | null) ?? null,
      thumbPath: (release.thumbPath as string | null) ?? null,
      coverRemote: (release.coverRemote as string | null) ?? null,
      thumbRemote: (release.thumbRemote as string | null) ?? null,
      images: parseJsonArray<ReleaseImage>(release.images as string | undefined, []),
    },
  };
}

export interface TrackRepository {
  listByRelease(releaseId: string): Promise<TrackRecord[]>;
  get(id: string): Promise<TrackRecord | null>;
  setLyrics(id: string, lyrics: string | null, src: string | null): Promise<void>;
}

export const trackRepo: TrackRepository = {
  async listByRelease(releaseId) {
    const prisma = getPrismaClient() as unknown as {
      track: { findMany: (a: unknown) => Promise<Array<Record<string, unknown>>> };
    };
    const rows = await prisma.track.findMany({ where: { releaseId } });
    return rows.map(trackFromRow);
  },
  async get(id) {
    const prisma = getPrismaClient() as unknown as {
      track: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> };
    };
    const row = await prisma.track.findUnique({ where: { id } });
    return row ? trackFromRow(row) : null;
  },
  async setLyrics(id, lyrics, src) {
    const prisma = getPrismaClient() as unknown as {
      track: { update: (a: unknown) => Promise<unknown> };
    };
    await prisma.track.update({ where: { id }, data: { lyrics, lyricsSrc: src } });
  },
};

function trackFromRow(row: Record<string, unknown>): TrackRecord {
  return {
    id: String(row.id),
    position: String(row.position ?? ''),
    title: String(row.title ?? ''),
    duration: (row.duration as number | null) ?? null,
    lyrics: (row.lyrics as string | null) ?? null,
    lyricsSrc: (row.lyricsSrc as string | null) ?? null,
  };
}
