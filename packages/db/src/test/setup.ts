import { afterAll, beforeAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetPrismaClient, setPrismaClient } from '../client';

let workDir: string;
let prisma: PrismaClient;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'vinylly-db-test-'));
  const dbPath = join(workDir, 'test.db');
  execSync(`pnpm exec prisma migrate deploy --schema prisma/schema.prisma`, {
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: 'ignore',
  });
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  setPrismaClient(prisma as never);
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

beforeEach(async () => {
  resetPrismaClient();
  await prisma.apiCache.deleteMany();
  await prisma.track.deleteMany();
  await prisma.item.deleteMany();
  await prisma.release.deleteMany();
  await prisma.collection.deleteMany();
  setPrismaClient(prisma as never);
});
