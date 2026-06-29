import { useEffect, useState } from 'react';
import {
  collectionRepo,
  itemRepo,
  trackRepo,
  setPrismaClient,
  type ItemRecord,
  type TrackRecord,
  type CreateItemInput,
  type ItemListFilter,
  type MediaType,
} from '@vinylly/db';

class LocalStoragePrisma {
  private kv = new Map<string, unknown>();
  private listeners = new Set<() => void>();
  constructor() {
    try {
      const raw = localStorage.getItem('vinylly:__prisma');
      if (raw) this.kv = new Map(JSON.parse(raw) as Array<[string, unknown]>);
    } catch {
      // ignore
    }
  }
  private persist() {
    try {
      localStorage.setItem('vinylly:__prisma', JSON.stringify(Array.from(this.kv.entries())));
    } catch {
      // localStorage quota — ignore for now
    }
    for (const l of this.listeners) l();
  }
  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  collection = {
    findFirst: async (_args?: unknown) => {
      return (this.kv.get('__collection') as { id: string; name: string } | null) ?? null;
    },
    create: async (args: { data: { id: string; name: string } }) => {
      const v = { id: args.data.id, name: args.data.name };
      this.kv.set('__collection', v);
      this.persist();
      return v;
    },
  };
  item = {
    findMany: async (args?: { where?: { collectionId?: string; type?: string } }) => {
      const all = Array.from(this.kv.entries())
        .filter(([k]) => k.startsWith('item:'))
        .map(([, v]) => v as Record<string, unknown>);
      let rows = all;
      if (args?.where?.collectionId) {
        rows = rows.filter((r) => r.collectionId === args.where!.collectionId);
      }
      if (args?.where?.type) {
        rows = rows.filter((r) => r.type === args.where!.type);
      }
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return rows;
    },
    findUnique: async (args: { where: { id: string } }) => {
      const v = this.kv.get(`item:${args.where.id}`);
      if (!v) return null;
      return this.hydrate(v as Record<string, unknown>);
    },
    create: async (args: { data: Record<string, unknown> }) => {
      const id = String(args.data.id);
      const createdAt = new Date().toISOString();
      const row = { ...args.data, createdAt, updatedAt: createdAt };
      this.kv.set(`item:${id}`, row);
      this.persist();
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const id = args.where.id;
      const existing = (this.kv.get(`item:${id}`) as Record<string, unknown>) ?? null;
      if (!existing) throw new Error(`Item not found: ${id}`);
      const updated = { ...existing, ...args.data, updatedAt: new Date().toISOString() };
      this.kv.set(`item:${id}`, updated);
      this.persist();
      return updated;
    },
    delete: async (args: { where: { id: string } }) => {
      this.kv.delete(`item:${args.where.id}`);
      this.persist();
      return { id: args.where.id };
    },
  };
  release = {
    findUnique: async (args: {
      where: { source_sourceId?: { source: string; sourceId: string } };
    }) => {
      if (!args.where.source_sourceId) return null;
      const { source, sourceId } = args.where.source_sourceId;
      for (const [k, v] of this.kv) {
        if (!k.startsWith('release:')) continue;
        const r = v as Record<string, unknown>;
        if (r.source === source && r.sourceId === sourceId) return r;
      }
      return null;
    },
    findFirst: async (args: { where: { id: string } }) => {
      return (this.kv.get(`release:${args.where.id}`) as Record<string, unknown> | null) ?? null;
    },
    upsert: async (args: {
      where: { source_sourceId: { source: string; sourceId: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const id = (args.create.id as string | undefined) ?? args.where.source_sourceId.sourceId;
      const key = `release:${id}`;
      const existing = (this.kv.get(key) as Record<string, unknown> | null) ?? null;
      const merged = existing
        ? { ...existing, ...args.update, id, updatedAt: new Date().toISOString() }
        : { ...args.create, id, updatedAt: new Date().toISOString() };
      this.kv.set(key, merged);
      this.persist();
      return merged;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const key = `release:${args.where.id}`;
      const existing = (this.kv.get(key) as Record<string, unknown> | null) ?? null;
      if (!existing) throw new Error(`Release not found: ${args.where.id}`);
      const merged = { ...existing, ...args.data, updatedAt: new Date().toISOString() };
      this.kv.set(key, merged);
      this.persist();
      return merged;
    },
  };
  track = {
    findMany: async (args: { where: { releaseId?: string } }) => {
      const rows = Array.from(this.kv.entries())
        .filter(([k]) => k.startsWith('track:'))
        .map(([, v]) => v as Record<string, unknown>);
      if (args.where.releaseId) {
        return rows.filter((r) => r.releaseId === args.where!.releaseId);
      }
      return rows;
    },
    findUnique: async (args: { where: { id: string } }) => {
      return (this.kv.get(`track:${args.where.id}`) as Record<string, unknown> | null) ?? null;
    },
    createMany: async (args: { data: Array<Record<string, unknown>> }) => {
      for (const t of args.data) this.kv.set(`track:${t.id}`, t);
      this.persist();
      return { count: args.data.length };
    },
    deleteMany: async (args: { where: { releaseId?: string } }) => {
      let count = 0;
      for (const [k, v] of Array.from(this.kv.entries())) {
        if (!k.startsWith('track:')) continue;
        const r = v as Record<string, unknown>;
        if (args.where.releaseId && r.releaseId === args.where.releaseId) {
          this.kv.delete(k);
          count += 1;
        }
      }
      this.persist();
      return { count };
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const existing = (this.kv.get(`track:${args.where.id}`) as Record<string, unknown>) ?? null;
      if (!existing) throw new Error(`Track not found: ${args.where.id}`);
      const updated = { ...existing, ...args.data };
      this.kv.set(`track:${args.where.id}`, updated);
      this.persist();
      return updated;
    },
  };
  apiCache = {
    findUnique: async () => null,
    upsert: async () => ({}),
  };
  async $disconnect() {
    return undefined;
  }
  private async hydrate(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    const releaseId = String(row.releaseId);
    const release = (this.kv.get(`release:${releaseId}`) as Record<string, unknown>) ?? null;
    return release ? { ...row, release } : row;
  }
}

let initialized = false;
let initPromise: Promise<{ id: string; name: string }> | null = null;

export function useVinylDbInit() {
  const [ready, setReady] = useState(initialized);
  useEffect(() => {
    if (initialized) return;
    if (!initPromise) {
      initPromise = (async () => {
        setPrismaClient(new LocalStoragePrisma() as never);
        const collection = await collectionRepo.ensureDefault();
        initialized = true;
        return collection;
      })();
    }
    initPromise.then(() => setReady(true));
  }, []);
  return ready;
}

export type { ItemRecord, TrackRecord, CreateItemInput, ItemListFilter, MediaType };
export { itemRepo, trackRepo };
