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

/** Decelerating slot-machine cadence — total ≈ 2.4 s. */
const SPIN_DELAYS = [55, 65, 75, 85, 100, 115, 135, 160, 190, 230, 285, 360, 470];

export function RandomPickModal({ open, items, onClose }: RandomPickModalProps) {
  const { t } = useTranslation();
  const openDetail = useUi((s) => s.openDetail);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, open, onClose);
  const [pickId, setPickId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const roll = useCallback(() => {
    if (!items.length) return;
    stopTimer();
    const final = items[Math.floor(Math.random() * items.length)]!;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPickId(final.id);
      setSpinning(false);
      return;
    }
    setSpinning(true);
    let tick = 0;
    const step = () => {
      setPickId(items[Math.floor(Math.random() * items.length)]!.id);
      tick += 1;
      if (tick < SPIN_DELAYS.length) {
        timerRef.current = setTimeout(step, SPIN_DELAYS[tick]);
      } else {
        setPickId(final.id);
        setSpinning(false);
      }
    };
    timerRef.current = setTimeout(step, SPIN_DELAYS[0]);
  }, [items, stopTimer]);

  useEffect(() => {
    if (open) {
      roll();
    } else {
      stopTimer();
      setPickId(null);
      setSpinning(false);
    }
    return stopTimer;
  }, [open, roll, stopTimer]);

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
                if (spinning) return;
                onClose();
                openDetail(pick.id);
              }}
              className={`rounded-base aspect-square w-full max-w-[240px] overflow-hidden transition-all duration-300 ${
                spinning
                  ? 'shadow-neu-lg scale-[0.97] blur-[2px] saturate-50'
                  : 'shadow-neu-2xl scale-100 blur-0 saturate-100'
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

            <div
              key={spinning ? 'spin' : pick.id}
              className={`text-center ${spinning ? '' : 'animate-rise'}`}
            >
              <div
                className={`text-fg-heading text-base font-semibold transition-all duration-200 ${
                  spinning ? 'blur-[1px] opacity-60' : ''
                }`}
              >
                {pick.release.title}
              </div>
              <div
                className={`text-fg-body-subtle mt-0.5 text-sm transition-all duration-200 ${
                  spinning ? 'blur-[1px] opacity-60' : ''
                }`}
              >
                {pick.release.artist}
                {pick.release.year ? ` · ${pick.release.year}` : ''}
              </div>
            </div>

            <div className="flex w-full items-center justify-center gap-2">
              <Button onClick={roll} disabled={spinning || items.length < 2} leftIcon={<DiceIcon />}>
                {spinning ? t('collection:random.spinning') : t('collection:random.reroll')}
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
