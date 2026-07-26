import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, useDialogA11y } from '@vinylly/ui';
import type { ItemRecord } from '@vinylly/db';
import { CoverImage } from './CoverImage';
import { useUi } from '../lib/ui-store';

export interface RandomPickModalProps {
  open: boolean;
  items: ItemRecord[];
  onClose: () => void;
}

export function RandomPickModal({ open, items, onClose }: RandomPickModalProps) {
  const { t } = useTranslation();
  const openDetail = useUi((s) => s.openDetail);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, open, onClose);
  const [pickId, setPickId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const roll = useCallback(() => {
    if (!items.length) return;
    setSpinning(true);
    // Brief slot-machine flicker before settling on the pick.
    let ticks = 0;
    const timer = setInterval(() => {
      setPickId(items[Math.floor(Math.random() * items.length)]!.id);
      ticks += 1;
      if (ticks >= 6) {
        clearInterval(timer);
        setSpinning(false);
      }
    }, 70);
  }, [items]);

  useEffect(() => {
    if (open) roll();
    else setPickId(null);
  }, [open, roll]);

  if (!open) return null;
  const pick = items.find((it) => it.id === pickId) ?? null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-overlay backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('collection:random.title')}
        className="rounded-base border-border-default bg-surface shadow-neu-xl w-full max-w-sm border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-fg-heading mb-4 text-center text-lg font-semibold">
          {t('collection:random.title')}
        </h2>
        {pick ? (
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                openDetail(pick.id);
              }}
              className={`rounded-base shadow-neu-xl aspect-square w-full max-w-[240px] overflow-hidden transition-neu hover:shadow-neu-2xl ${
                spinning ? 'animate-pulse' : ''
              }`}
              aria-label={t('collection:item.open_aria', { title: pick.release.title })}
            >
              <CoverImage
                releaseId={pick.release.id}
                coverPath={pick.release.coverPath}
                coverRemote={pick.release.coverRemote}
                alt={t('collection:item.cover_alt', { title: pick.release.title })}
                size="full"
                elevated={false}
              />
            </button>
            <div className="text-center">
              <div className="text-fg-heading text-base font-semibold">{pick.release.title}</div>
              <div className="text-fg-body-subtle mt-0.5 text-sm">
                {pick.release.artist}
                {pick.release.year ? ` · ${pick.release.year}` : ''}
              </div>
            </div>
            <div className="flex w-full items-center justify-center gap-2">
              <Button onClick={roll} disabled={spinning || items.length < 2} leftIcon={<DiceIcon />}>
                {t('collection:random.reroll')}
              </Button>
              <Button variant="neutral" onClick={onClose}>
                {t('common:button.close')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-fg-body-subtle text-center text-sm">{t('collection:empty.title')}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
