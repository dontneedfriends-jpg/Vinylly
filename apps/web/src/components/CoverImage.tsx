import { useEffect, useState } from 'react';
import { getHostShell } from '@vinylly/host';

export interface CoverImageProps {
  releaseId: string;
  coverPath: string | null;
  coverRemote: string | null;
  alt: string;
  size?: 'thumb' | 'full';
  className?: string;
}

function bytesToBlobUrl(bytes: Uint8Array): string {
  const arr = new Uint8Array(bytes);
  const ext = 'image/jpeg';
  const blob = new Blob([arr], { type: ext });
  return URL.createObjectURL(blob);
}

export function CoverImage({
  releaseId,
  coverPath,
  coverRemote,
  alt,
  size = 'thumb',
  className = '',
}: CoverImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setLoading(true);
    setSrc(null);

    async function load() {
      if (coverPath) {
        try {
          const shell = getHostShell();
          const bytes = await shell.fs().readBinary(coverPath);
          if (cancelled) return;
          const url = bytesToBlobUrl(bytes);
          revoke = url;
          setSrc(url);
          return;
        } catch {
          // fall through to remote
        }
      }
      if (coverRemote) {
        if (!cancelled) setSrc(coverRemote);
        return;
      }
      // placeholder by source-less chip
      if (!cancelled) setSrc(null);
    }
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [releaseId, coverPath, coverRemote]);

  return (
    <div
      className={
        'relative flex h-full w-full items-center justify-center overflow-hidden ' +
        'bg-surface border-border-default rounded-base border' +
        (size === 'thumb' ? 'shadow-neu-inset' : 'shadow-neu-md') +
        ' ' +
        className
      }
      role="img"
      aria-label={alt}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : loading ? (
        <span className="text-fg-body-subtle text-xs">…</span>
      ) : (
        <span className="text-fg-body-subtle px-3 text-center text-xs">Нет обложки</span>
      )}
    </div>
  );
}
