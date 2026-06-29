import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { setPrismaClient, collectionRepo, itemRepo } from '../src/index.js';

loadEnv({ path: '.env' });
loadEnv({ path: '../.env' });

const prisma = new PrismaClient();
setPrismaClient(prisma as never);

const releases = [
  {
    type: 'vinyl' as const,
    release: {
      source: 'manual' as const,
      sourceId: 'demo-1',
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      year: 1959,
      genres: ['Jazz'],
      styles: ['Modal'],
    },
    notes: 'Оригинальное издание на 180г.',
    location: 'Полка A1',
    tracklist: [
      { position: 'A1', title: 'So What', duration: 565000 },
      { position: 'A2', title: 'Freddie Freeloader', duration: 590000 },
      { position: 'B1', title: 'Blue in Green', duration: 337000 },
    ],
  },
  {
    type: 'cd' as const,
    release: {
      source: 'manual' as const,
      sourceId: 'demo-2',
      title: 'OK Computer',
      artist: 'Radiohead',
      year: 1997,
      genres: ['Rock'],
      styles: ['Alternative'],
    },
    location: 'Полка B3',
    tracklist: [
      { position: '1', title: 'Airbag', duration: 285000 },
      { position: '2', title: 'Paranoid Android', duration: 387000 },
    ],
  },
];

async function main() {
  const col = await collectionRepo.ensureDefault();
  for (const r of releases) {
    await itemRepo.create({ collectionId: col.id, ...r, tags: ['demo'] });
  }
  console.info(`Seeded ${releases.length} items in collection "${col.name}"`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
