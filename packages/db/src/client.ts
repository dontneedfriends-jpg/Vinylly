let prismaInstance: unknown = null;

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
  $disconnect: () => Promise<void>;
}

export function setPrismaClient(client: PrismaLike): void {
  prismaInstance = client;
}

export function resetPrismaClient(): void {
  prismaInstance = null;
}

export function getPrismaClient(): PrismaLike {
  if (!prismaInstance) {
    throw new Error('Prisma client not initialized. Call setPrismaClient() at app boot.');
  }
  return prismaInstance as PrismaLike;
}

export * from './types';
