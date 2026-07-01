import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' });
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
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setStatus('loading');
    setSrc(null);

    async function load() {
      // 1. Try local cached cover via HostFs
      if (coverPath) {
        try {
          const shell = getHostShell();
          const bytes = await shell.fs().readBinary(coverPath);
          if (cancelled) return;
          const url = bytesToBlobUrl(bytes);
          revoke = url;
          setSrc(url);
          setStatus('ok');
          return;
        } catch {
          // fall through to remote
        }
      }
      // 2. Fall back to remote URL — `<img>` loads it; onError marks missing.
      if (coverRemote) {
        if (!cancelled) {
          setSrc(coverRemote);
          // status stays loading until <img> onLoad/onError fires
        }
        return;
      }
      if (!cancelled) setStatus('missing');
    }
    void load();

    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [releaseId, coverPath, coverRemote]);

  return (
    <div
      className={`rounded-base border-border-default bg-surface relative flex h-full w-full items-center justify-center overflow-hidden border ${
        size === 'thumb' ? 'shadow-neu-inset' : 'shadow-neu-md'
      } ${className}`}
      role="img"
      aria-label={alt}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('missing')}
        />
      ) : status === 'loading' ? (
        <span className="text-fg-body-subtle text-xs">…</span>
      ) : (
        <span className="text-fg-body-subtle px-3 text-center text-xs">{t('common:cover.no_cover')}</span>
      )}
    </div>
  );
}
