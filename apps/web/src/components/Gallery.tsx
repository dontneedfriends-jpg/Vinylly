import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHostShell } from '@vinylly/host';
import type { ReleaseImage } from '@vinylly/db';

export interface GalleryProps {
  releaseId: string;
  images: ReleaseImage[];
}

function bytesToBlobUrl(bytes: Uint8Array): string {
  const blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

async function loadImageLocal(img: ReleaseImage): Promise<string | null> {
  if (img.localPath) {
    try {
      const shell = getHostShell();
      const bytes = await shell.fs().readBinary(img.localPath);
      return bytesToBlobUrl(bytes);
    } catch {
      // fallback to remote
    }
  }
  return img.uri || null;
}

export function Gallery({ releaseId, images: initialImages }: GalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [items, setItems] = useState(initialImages);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => { setItems(initialImages); }, [initialImages]);

  if (items.length === 0) return null;

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const copy = [...items];
    const [moved] = copy.splice(dragIdx.current, 1) as [ReleaseImage];
    copy.splice(i, 0, moved);
    setItems(copy);
    dragIdx.current = i;
  };
  const onDragEnd = () => { dragIdx.current = null; };

  return (
    <>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
        {items.map((img, i) => (
          <div
            key={`${i}-${img.uri}`}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing"
          >
            <Thumbnail
              image={img}
              releaseId={releaseId}
              active={i === selectedIndex}
              onClick={() => {
                setSelectedIndex(i);
                setLightboxOpen(true);
              }}
            />
          </div>
        ))}
      </div>

      {lightboxOpen ? (
        <Lightbox
          images={items}
          releaseId={releaseId}
          startIndex={selectedIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

/* ─── Thumbnail ─── */

function Thumbnail({
  image,
  active,
  onClick,
}: {
  image: ReleaseImage;
  releaseId: string;
  active: boolean;
  onClick: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadImageLocal(image).then((url) => {
      if (!cancelled && url) setSrc(url);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.localPath, image.uri]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={image.type}
      className={`aspect-square overflow-hidden rounded-base border transition-all duration-200 ${
        active
          ? 'border-border-default shadow-neu-inset'
          : 'border-border-default-medium shadow-neu-2xs hover:shadow-neu-xs'
      }`}
    >
      {src ? (
        <img
          src={src}
          alt={image.type}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface">
          <span className="text-fg-body-subtle text-[10px]">…</span>
        </div>
      )}
    </button>
  );
}

/* ─── Lightbox ─── */

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: ReleaseImage[];
  releaseId: string;
  startIndex: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [src, setSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const current = images[currentIndex];
  const total = images.length;

  useEffect(() => {
    setScale(1);
    setSrc(null);
    if (!current) return;
    let cancelled = false;
    void loadImageLocal(current).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      setScale((s) => Math.max(1, Math.min(10, s * factor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [src]);

  const goPrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  const typeLabels: Record<string, string> = {
    primary: t('common:image_type.primary'),
    secondary: t('common:image_type.secondary'),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowLeft') goPrev();
        if (e.key === 'ArrowRight') goNext();
      }}
      role="dialog"
      aria-label="Image preview"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        aria-label="Close"
      >
        <CloseIcon />
      </button>

      {total > 1 ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeftIcon />
        </button>
      ) : null}

      {total > 1 ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          aria-label="Next"
        >
          <ChevronRightIcon />
        </button>
      ) : null}

      <div
        className="flex max-h-[90vh] max-w-[90vw] items-start justify-center overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt={current?.type ?? ''}
            className={`shrink-0 transition-transform duration-200 ${
              scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'
            }`}
            style={{
              maxHeight: scale > 1 ? 'none' : '90vh',
              maxWidth: scale > 1 ? 'none' : '90vw',
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
            onClick={() => setScale((s) => (s > 1 ? 1 : 2))}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center">
            <span className="text-white/60 text-sm">…</span>
          </div>
        )}
      </div>

      {total > 1 ? (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white/80">
          <span>{currentIndex + 1} / {total}</span>
          {current?.type ? (
            <span className="ml-2 text-white/60">{typeLabels[current.type] ?? current.type}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Icons ─── */

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
