const clients = new Map<string, PrismaLike>();
let activeId: string | null = null;

export interface PrismaLike {
  collection: {
    findFirst: (args?: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
  item: {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
  release: {
    findUnique: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  track: {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  apiCache: {
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  wantlistEntry?: {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findFirst: (args?: unknown) => Promise<unknown | null>;
    create: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
  $disconnect?: () => Promise<void>;
}

/**
 * Register a Prisma-like client for a profile.
 * Calling without `profileId` falls back to the active profile (or
 * the singleton slot used before multi-profile support existed).
 */
export function setPrismaClient(client: PrismaLike, profileId?: string): void {
  if (!profileId) {
    activeId = '__singleton__';
    clients.set(activeId, client);
    return;
  }
  clients.set(profileId, client);
  if (!activeId) activeId = profileId;
}

export function resetPrismaClient(profileId?: string): void {
  if (!profileId) {
    clients.clear();
    activeId = null;
    return;
  }
  const removed = clients.delete(profileId);
  if (activeId === profileId) {
    activeId = clients.keys().next().value ?? null;
  }
  void removed;
}

/** Switch the active profile. The next `getPrismaClient()` returns that profile's client. */
export function setActivePrismaProfile(profileId: string | null): void {
  activeId = profileId;
}

/** Get the client for the active profile (or the singleton slot). */
export function getPrismaClient(): PrismaLike {
  const id = activeId ?? '__singleton__';
  const c = clients.get(id);
  if (!c) {
    throw new Error(
      `Prisma client not initialized for profile "${activeId ?? '(none)'}". Call setPrismaClient() at app boot.`,
    );
  }
  return c;
}

/** Look up a client for an explicit profile id. */
export function getPrismaClientFor(profileId: string): PrismaLike | undefined {
  return clients.get(profileId);
}

export * from './types';
