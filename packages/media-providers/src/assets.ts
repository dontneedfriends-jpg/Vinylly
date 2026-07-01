import { getHostShell } from '@vinylly/host';
import type { NormalizedRelease } from './types';
import { withCache } from './cache';

export interface CachedCover {
  coverPath: string;
  thumbPath: string;
}

export interface CachedImage {
  type: string;
  uri: string;
  uri150?: string | null;
  localPath: string | null;
}

export interface CacheCoverOptions {
  releaseId: string;
  coverUrl: string;
  thumbUrl?: string | null;
}

export async function cacheCover(opts: CacheCoverOptions): Promise<CachedCover> {
  const shell = getHostShell();
  const fs = shell.fs();
  const coversDir = shell.paths().coversDir;
  await fs.ensureDir(coversDir);
  const coverExt = guessExt(opts.coverUrl);
  const coverPath = fs.join(coversDir, `${opts.releaseId}${coverExt}`);
  const thumbPath = fs.join(coversDir, `${opts.releaseId}_thumb.jpg`);

  const [coverBytes, thumbBytes] = await Promise.all([
    fetchBytes(opts.coverUrl),
    opts.thumbUrl && opts.thumbUrl !== opts.coverUrl
      ? fetchBytes(opts.thumbUrl).catch(() => null)
      : Promise.resolve(null),
  ]);
  await fs.writeBinary(coverPath, coverBytes);
  if (thumbBytes) {
    await fs.writeBinary(thumbPath, thumbBytes);
  } else {
    await fs.writeBinary(thumbPath, coverBytes);
  }
  return { coverPath, thumbPath };
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  return withCache(`cover:${url}`, 1000 * 60 * 60 * 24, () =>
    getHostShell().net().fetchBinary(url),
  );
}

function guessExt(url: string): string {
  const m = url.match(/\.(png|jpg|jpeg|webp)(\?|$)/i);
  if (!m || !m[1]) return '.jpg';
  return `.${m[1].toLowerCase().replace('jpeg', 'jpg')}`;
}

export async function ensureReleaseAssets(
  release: NormalizedRelease,
  releaseId: string,
): Promise<{
  coverPath: string | null;
  thumbPath: string | null;
  coverRemote: string;
  thumbRemote: string | null;
  images: CachedImage[];
}> {
  const shell = getHostShell();
  const fs = shell.fs();
  const coversDir = shell.paths().coversDir;
  await fs.ensureDir(coversDir);

  let coverPath: string | null = null;
  let thumbPath: string | null = null;
  const coverRemote = release.coverUrl ?? '';
  const thumbRemote = release.thumbUrl ?? null;

  const tasks: Promise<void>[] = [];

  if (release.coverUrl) {
    tasks.push(
      (async () => {
        try {
          const coverExt = guessExt(release.coverUrl!);
          const cp = fs.join(coversDir, `${releaseId}${coverExt}`);
          const tp = fs.join(coversDir, `${releaseId}_thumb.jpg`);

          const [coverBytes, thumbBytes] = await Promise.all([
            fetchBytes(release.coverUrl!),
            release.thumbUrl && release.thumbUrl !== release.coverUrl
              ? fetchBytes(release.thumbUrl).catch(() => null)
              : Promise.resolve(null),
          ]);
          await fs.writeBinary(cp, coverBytes);
          await fs.writeBinary(tp, thumbBytes ?? coverBytes);
          coverPath = cp;
          thumbPath = tp;
        } catch {
          // keep remote
        }
      })(),
    );
  }

  const images: CachedImage[] = [];
  if (release.images?.length) {
    for (let i = 0; i < release.images.length; i++) {
      const img = release.images[i]!;
      const idx = i;
      images[idx] = { type: img.type, uri: img.uri, uri150: img.uri150 ?? null, localPath: null };
      tasks.push(
        (async () => {
          try {
            const ext = guessExt(img.uri);
            const path = fs.join(coversDir, `${releaseId}_${idx}${ext}`);
            const bytes = await fetchBytes(img.uri);
            await fs.writeBinary(path, bytes);
            images[idx] = { type: img.type, uri: img.uri, uri150: img.uri150 ?? null, localPath: path };
          } catch {
            // keep remote — localPath stays null
          }
        })(),
      );
    }
  }

  await Promise.all(tasks);

  return { coverPath, thumbPath, coverRemote, thumbRemote, images };
}
