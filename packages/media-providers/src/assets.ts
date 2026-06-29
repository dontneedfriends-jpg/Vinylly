import { getHostShell } from '@vinylly/host';
import type { NormalizedRelease } from './types';
import { withCache } from './cache';

export interface CachedCover {
  coverPath: string;
  thumbPath: string;
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
}> {
  if (!release.coverUrl) {
    return {
      coverPath: null,
      thumbPath: null,
      coverRemote: '',
      thumbRemote: release.thumbUrl ?? null,
    };
  }
  try {
    const cached = await cacheCover({
      releaseId,
      coverUrl: release.coverUrl,
      thumbUrl: release.thumbUrl,
    });
    return {
      coverPath: cached.coverPath,
      thumbPath: cached.thumbPath,
      coverRemote: release.coverUrl,
      thumbRemote: release.thumbUrl ?? null,
    };
  } catch {
    return {
      coverPath: null,
      thumbPath: null,
      coverRemote: release.coverUrl,
      thumbRemote: release.thumbUrl ?? null,
    };
  }
}
