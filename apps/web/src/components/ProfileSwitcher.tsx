import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../lib/profile-store';
import { switchActiveProfile } from '../lib/db';
import { ProfileManager } from './ProfileManager';

export function ProfileSwitcher() {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const switchProfile = useProfileStore((s) => s.switchProfile);
  const [open, setOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const active = profiles.find((p) => p.id === activeId);

  const onPick = async (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await switchProfile(id);
    await switchActiveProfile(id);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-base bg-surface shadow-neu-2xs hover:shadow-neu-xs flex w-full min-h-[44px] items-center justify-between gap-2 px-3 py-2 transition-neu"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ProfileIcon className="text-fg-brand h-4 w-4 shrink-0" />
          <span className="text-fg-heading truncate text-sm font-medium">
            {active?.label ?? t('profile:switcher.none')}
          </span>
        </span>
        <CaretIcon
          className={`text-fg-body-subtle h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="rounded-base border-border-default bg-surface shadow-neu-md absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto border p-1"
        >
          {profiles.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => void onPick(p.id)}
                className={`flex w-full items-center gap-2 rounded-base px-3 py-2 text-left text-sm transition-neu ${
                  isActive
                    ? 'text-fg-heading shadow-neu-inset font-semibold'
                    : 'text-fg-body hover:text-fg-heading hover:shadow-neu-2xs'
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {isActive ? <CheckIcon className="text-fg-heading h-4 w-4" /> : null}
                </span>
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}
          <div className="bg-surface my-1 h-px" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setManagerOpen(true);
            }}
            className="text-fg-body hover:text-fg-heading hover:shadow-neu-2xs flex w-full items-center gap-2 rounded-base px-3 py-2 text-left text-sm transition-neu"
          >
            <PlusIcon className="text-fg-brand h-3.5 w-3.5" />
            <span>{t('profile:switcher.manage')}</span>
          </button>
        </div>
      ) : null}
      <ProfileManager open={managerOpen} onClose={() => setManagerOpen(false)} />
    </div>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21c.6-3.6 3.4-6 7-6s6.4 2.4 7 6" strokeLinecap="round" />
    </svg>
  );
}

function CaretIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
      <path d="M5 12l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
