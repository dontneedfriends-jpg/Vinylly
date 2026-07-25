import { useEffect, useState } from 'react';
import {
  collectionRepo,
  itemRepo,
  trackRepo,
  setPrismaClient,
  setActivePrismaProfile,
  type CreateItemInput,
  type ItemListFilter,
  type ItemRecord,
  type MediaType,
  type TrackRecord,
} from '@vinylly/db';
import {
  createWebHostShell,
  isTauriEnvironment,
  setHostShell,
  type ProfileRecord,
} from '@vinylly/host';
import { useProfileStore } from './profile-store';

const isTauri = isTauriEnvironment;

const TAURI_TIMEOUT_MS = 2000;

async function tauriLoadSnapshot(profileId: string | null): Promise<unknown | null> {
  if (!isTauri()) return null;
  return Promise.race([
    window.__TAURI_INTERNALS__!.invoke<unknown>('db_load', { profileId: profileId ?? undefined }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TAURI_TIMEOUT_MS)),
  ]);
}

async function tauriSaveSnapshot(snap: unknown, profileId: string | null): Promise<void> {
  if (!isTauri()) return;
  await Promise.race([
    window.__TAURI_INTERNALS__!.invoke('db_replace', {
      snapshot: snap,
      profileId: profileId ?? undefined,
    }),
    new Promise<void>((resolve) => setTimeout(() => resolve(), TAURI_TIMEOUT_MS)),
  ]);
}

interface DbSnapshot {
  collection: unknown | null;
  items: Array<[string, unknown]>;
  releases: Array<[string, unknown]>;
  tracks: Array<[string, unknown]>;
  wantlist: Array<[string, unknown]>;
  profileSettings: { id: string; data: Record<string, unknown> } | null;
}

class LocalStoragePrisma {
  private kv = new Map<string, unknown>();
  private listeners = new Set<() => void>();
  private storageKey: string;
  constructor(initial: DbSnapshot | null, storageKey: string) {
    this.storageKey = storageKey;
    try {
      const entries = initial
        ? this.fromSnapshot(initial)
        : this.readFromStorage();
      for (const [k, v] of entries) this.kv.set(k, v);
    } catch {
      /* ignore */
    }
  }
  private readFromStorage(): Array<[string, unknown]> {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<[string, unknown]>;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  private fromSnapshot(initial: DbSnapshot): Array<[string, unknown]> {
    const entries: Array<[string, unknown]> = [];
    if (initial.collection) entries.push(['__collection', initial.collection]);
    for (const [k, v] of initial.items) entries.push([`item:${k}`, v]);
    for (const [k, v] of initial.releases) entries.push([`release:${k}`, v]);
    for (const [k, v] of initial.tracks) entries.push([`track:${k}`, v]);
    for (const [k, v] of initial.wantlist) entries.push([`wantlist:${k}`, v]);
    if (initial.profileSettings) entries.push(['__profile_settings', initial.profileSettings]);
    return entries;
  }
  private toSnapshot(): DbSnapshot {
    return {
      collection: this.kv.get('__collection') ?? null,
      items: Array.from(this.kv.entries())
        .filter(([k]) => k.startsWith('item:'))
        .map(([k, v]) => [k.slice('item:'.length), v]),
      releases: Array.from(this.kv.entries())
        .filter(([k]) => k.startsWith('release:'))
        .map(([k, v]) => [k.slice('release:'.length), v]),
      tracks: Array.from(this.kv.entries())
        .filter(([k]) => k.startsWith('track:'))
        .map(([k, v]) => [k.slice('track:'.length), v]),
      wantlist: Array.from(this.kv.entries())
        .filter(([k]) => k.startsWith('wantlist:'))
        .map(([k, v]) => [k.slice('wantlist:'.length), v]),
      profileSettings:
        (this.kv.get('__profile_settings') as { id: string; data: Record<string, unknown> } | undefined) ?? null,
    };
  }
  private async persist(profileId: string | null) {
    try {
      const serialized = Array.from(this.kv.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(serialized));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded');
      } else {
        console.warn('localStorage write failed', e);
      }
    }
    if (isTauri()) {
      try {
        await tauriSaveSnapshot(this.toSnapshot(), profileId);
      } catch (e) {
        console.error('Tauri snapshot save failed, data may not persist on reload', e);
      }
    }
    for (const l of this.listeners) l();
  }
  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  collection = {
    findFirst: async (_args?: unknown) => {
      return (this.kv.get('__collection') as { id: string; name: string } | null) ?? null;
    },
    create: async (args: { data: { id: string; name: string } }) => {
      const v = { id: args.data.id, name: args.data.name };
      this.kv.set('__collection', v);
      await this.persist(this.profileId);
      return v;
    },
  };
  item = {
    findMany: async (args?: {
      where?: { collectionId?: string; type?: string };
      include?: { release?: boolean };
    }) => {
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
      return rows.map((r) => this.hydrateSync(r));
    },
    findUnique: async (args: { where: { id: string } }) => {
      const v = this.kv.get(`item:${args.where.id}`);
      if (!v) return null;
      return this.hydrate(v as Record<string, unknown>);
    },
    findFirst: async (args?: {
      where?: { release?: { source?: string; sourceId?: string } };
      include?: { release?: boolean };
    }) => {
      const src = args?.where?.release;
      if (!src?.source || !src?.sourceId) return null;
      for (const [k, v] of this.kv) {
        if (!k.startsWith('item:')) continue;
        const row = v as Record<string, unknown>;
        const releaseKey = `release:${row.releaseId as string}`;
        const rel = this.kv.get(releaseKey) as Record<string, unknown> | undefined;
        if (rel && rel.source === src.source && rel.sourceId === src.sourceId) {
          return this.hydrateSync(row);
        }
      }
      return null;
    },
    create: async (args: { data: Record<string, unknown> }) => {
      const id = String(args.data.id);
      const createdAt = new Date().toISOString();
      const row = { ...args.data, createdAt, updatedAt: createdAt };
      this.kv.set(`item:${id}`, row);
      await this.persist(this.profileId);
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const id = args.where.id;
      const existing = (this.kv.get(`item:${id}`) as Record<string, unknown>) ?? null;
      if (!existing) throw new Error(`Item not found: ${id}`);
      const updated = { ...existing, ...args.data, updatedAt: new Date().toISOString() };
      this.kv.set(`item:${id}`, updated);
      await this.persist(this.profileId);
      return updated;
    },
    delete: async (args: { where: { id: string } }) => {
      this.kv.delete(`item:${args.where.id}`);
      await this.persist(this.profileId);
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
      await this.persist(this.profileId);
      return merged;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const key = `release:${args.where.id}`;
      const existing = (this.kv.get(key) as Record<string, unknown> | null) ?? null;
      if (!existing) throw new Error(`Release not found: ${args.where.id}`);
      const merged = { ...existing, ...args.data, updatedAt: new Date().toISOString() };
      this.kv.set(key, merged);
      await this.persist(this.profileId);
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
      await this.persist(this.profileId);
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
      await this.persist(this.profileId);
      return { count };
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const existing = (this.kv.get(`track:${args.where.id}`) as Record<string, unknown>) ?? null;
      if (!existing) throw new Error(`Track not found: ${args.where.id}`);
      const updated = { ...existing, ...args.data };
      this.kv.set(`track:${args.where.id}`, updated);
      await this.persist(this.profileId);
      return updated;
    },
  };
  apiCache = {
    findUnique: async () => null,
    upsert: async () => ({}),
  };
  profileSettings = {
    findFirst: async () => {
      const v = this.kv.get('__profile_settings') as
        | { id: string; data: Record<string, unknown> }
        | undefined;
      return v ?? null;
    },
    upsert: async (args: {
      where?: { id?: string };
      create?: { id: string; data: Record<string, unknown> };
      update?: { data?: Record<string, unknown> };
    }) => {
      const id = args?.where?.id ?? args?.create?.id ?? 'singleton';
      const data = args?.update?.data ?? args?.create?.data ?? {};
      const row = { id, data };
      this.kv.set('__profile_settings', row);
      await this.persist(this.profileId);
      return row;
    },
  };
  wantlistEntry = {
    findMany: async (args?: {
      include?: { release?: boolean };
      orderBy?: { addedAt?: 'asc' | 'desc' };
    }) => {
      const all = Array.from(this.kv.entries())
        .filter(([k]) => k.startsWith('wantlist:'))
        .map(([, v]) => v as Record<string, unknown>);
      const dir = args?.orderBy?.addedAt === 'asc' ? 1 : -1;
      all.sort((a, b) => dir * String(a.addedAt).localeCompare(String(b.addedAt)));
      if (args?.include?.release) {
        return all.map((r) => {
          if (r.release) return r;
          const rel = (this.kv.get(`release:${r.releaseId as string}`) as Record<string, unknown>) ?? null;
          return rel ? { ...r, release: rel } : r;
        });
      }
      return all;
    },
    findFirst: async (args: {
      where: { release?: { source?: string; sourceId?: string } };
    }) => {
      const src = args.where.release;
      if (!src?.source || !src.sourceId) return null;
      for (const [k, v] of this.kv) {
        if (!k.startsWith('wantlist:')) continue;
        const row = v as Record<string, unknown>;
        const rel = (this.kv.get(`release:${row.releaseId as string}`) as Record<string, unknown>) ?? null;
        if (rel && rel.source === src.source && rel.sourceId === src.sourceId) {
          return { ...row, release: rel };
        }
      }
      return null;
    },
    create: async (args: { data: Record<string, unknown> }) => {
      const id = String(args.data.id);
      const addedAt = new Date().toISOString();
      const row: Record<string, unknown> = { ...args.data, addedAt };
      this.kv.set(`wantlist:${id}`, row);
      await this.persist(this.profileId);
      return { ...row, release: this.kv.get(`release:${String(row.releaseId)}`) ?? null };
    },
    delete: async (args: { where: { id: string } }) => {
      this.kv.delete(`wantlist:${args.where.id}`);
      await this.persist(this.profileId);
      return { id: args.where.id };
    },
  };
  async $disconnect() {
    return undefined;
  }
  setProfileId(id: string) {
    this.profileId = id;
  }
  private profileId: string = '';
  private hydrateSync(row: Record<string, unknown>): Record<string, unknown> {
    if (row.release) return row;
    const releaseId = String(row.releaseId);
    const release = (this.kv.get(`release:${releaseId}`) as Record<string, unknown>) ?? null;
    return release ? { ...row, release } : row;
  }
  private async hydrate(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.hydrateSync(row);
  }
}

let initialized = false;
let initPromise: Promise<void> | null = null;
let initPromiseForProfile: string | null = null;
let currentProfileId: string | null = null;
let currentClient: LocalStoragePrisma | null = null;

function storageKeyFor(profileId: string): string {
  return `vinylly:db:${profileId}`;
}

async function bootstrapClient(profileId: string): Promise<LocalStoragePrisma> {
  if (currentProfileId === profileId && currentClient) return currentClient;
  if (isTauri()) {
    // Bound the Tauri snapshot load — if the bridge is missing or hung
    // (e.g. dev Vite where __TAURI_INTERNALS__ is a stub) we fall back
    // to an empty snapshot rather than blocking the UI.
    const initial = await Promise.race([
      tauriLoadSnapshot(profileId),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    currentClient = new LocalStoragePrisma(initial as DbSnapshot | null, storageKeyFor(profileId));
  } else {
    currentClient = new LocalStoragePrisma(null, storageKeyFor(profileId));
  }
  currentClient.setProfileId(profileId);
  setPrismaClient(currentClient as never, profileId);
  setActivePrismaProfile(profileId);
  currentProfileId = profileId;
  // Web fallback host shell — App.tsx sets it for Tauri. In dev Vite
  // isTauriEnvironment() returns false so we always set it here.
  if (!isTauriEnvironment()) {
    try {
      setHostShell(createWebHostShell(profileId));
    } catch {
      /* host init may be deferred */
    }
  }
  return currentClient;
}

/**
 * Switch the active DB client to the given profile.
 * Use after `initProfiles()` resolves and on every profile switch.
 */
export async function switchActiveProfile(profileId: string): Promise<void> {
  await bootstrapClient(profileId);
}

/**
 * Serialize current profile's snapshot as JSON.
 */
export function serializeDb(): string {
  if (!currentClient) throw new Error('No active profile');
  return JSON.stringify(Array.from((currentClient as unknown as { kv: Map<string, unknown> }).kv.entries()));
}

/**
 * Restore a profile from a JSON backup file. Loads into the active profile
 * (or into a brand-new profile if `targetProfileLabel` is provided).
 */
export async function restoreFromJsonFile(
  file: File,
  options: { targetProfileLabel?: string } = {},
): Promise<void> {
  if (!currentProfileId && !options.targetProfileLabel) {
    throw new Error('No active profile');
  }
  const text = await file.text();
  const data = JSON.parse(text) as unknown;
  let entries: Array<[string, unknown]>;
  if (Array.isArray(data)) {
    entries = data as Array<[string, unknown]>;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    entries = [];
    if (obj.collection) entries.push(['__collection', obj.collection]);
    if (Array.isArray(obj.items)) {
      for (const [k, v] of obj.items as Array<[string, unknown]>) entries.push([`item:${k}`, v]);
    }
    if (Array.isArray(obj.releases)) {
      for (const [k, v] of obj.releases as Array<[string, unknown]>) entries.push([`release:${k}`, v]);
    }
    if (Array.isArray(obj.tracks)) {
      for (const [k, v] of obj.tracks as Array<[string, unknown]>) entries.push([`track:${k}`, v]);
    }
    if (Array.isArray(obj.wantlist)) {
      for (const [k, v] of obj.wantlist as Array<[string, unknown]>) entries.push([`wantlist:${k}`, v]);
    }
    if (obj.profileSettings) entries.push(['__profile_settings', obj.profileSettings]);
  } else {
    throw new Error('Invalid backup format');
  }

  let targetId = currentProfileId;
  if (options.targetProfileLabel) {
    const created = await useProfileStore.getState().createProfile(options.targetProfileLabel);
    targetId = created.id;
    await switchActiveProfile(targetId);
  }

  localStorage.setItem(storageKeyFor(targetId!), JSON.stringify(entries));

  if (isTauri() && targetId) {
    const profileSettings = (entries.find(([k]) => k === '__profile_settings')?.[1] ?? null) as
      | { id: string; data: Record<string, unknown> }
      | null;
    const snap: DbSnapshot = {
      collection: entries.find(([k]) => k === '__collection')?.[1] ?? null,
      items: entries.filter(([k]) => k.startsWith('item:')).map(([k, v]) => [k.slice('item:'.length), v]),
      releases: entries.filter(([k]) => k.startsWith('release:')).map(([k, v]) => [k.slice('release:'.length), v]),
      tracks: entries.filter(([k]) => k.startsWith('track:')).map(([k, v]) => [k.slice('track:'.length), v]),
      wantlist: entries.filter(([k]) => k.startsWith('wantlist:')).map(([k, v]) => [k.slice('wantlist:'.length), v]),
      profileSettings,
    };
    await tauriSaveSnapshot(snap, targetId);
  }

  // Reload the client so UI sees new data.
  if (targetId) await bootstrapClient(targetId);
}

/**
 * Initialize the DB for the active profile and ensure default collection exists.
 * Returns the active profile id once ready.
 */
export function useVinylDbInit() {
  const [ready, setReady] = useState(initialized);
  const activeId = useProfileStore((s) => s.activeId);
  useEffect(() => {
    let cancelled = false;
    if (!activeId) return () => undefined;
    if (initialized && currentProfileId === activeId) {
      setReady(true);
      return () => undefined;
    }
    // Create a new initPromise only if one isn't already flying for this
    // exact profile.  Using initPromiseForProfile avoids reusing a promise
    // that was created for a *different* activeId (critical in StrictMode
    // where effects mount → unmount → mount with different values).
    if (!initPromise || initPromiseForProfile !== activeId) {
      initPromiseForProfile = activeId;
      initPromise = (async () => {
        try {
          await bootstrapClient(activeId);
          await collectionRepo.ensureDefault();
          initialized = true;
        } catch (err) {
          console.error('[useVinylDbInit] bootstrap failed', err);
          initialized = true;
        }
      })();
    }
    const promise = initPromise;
    promise
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);
  return ready;
}

/** Used by tests; not part of public API. */
export function __resetDbStateForTests() {
  initialized = false;
  initPromise = null;
  initPromiseForProfile = null;
  currentProfileId = null;
  currentClient = null;
}

export type { ItemRecord, TrackRecord, CreateItemInput, ItemListFilter, MediaType, ProfileRecord };
export { itemRepo, trackRepo };
