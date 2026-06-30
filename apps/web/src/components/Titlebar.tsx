import { useEffect, useState } from 'react';
import { isTauriEnvironment } from '@vinylly/host';
import { useUi } from '../lib/ui-store';
import {
  closeWindow,
  isMaximized,
  minimizeWindow,
  startDragging,
  toggleMaximize,
} from '../lib/window-controls';

export function Titlebar() {
  const page = useUi((s) => s.page);
  const openCollection = useUi((s) => s.openCollection);
  const [tauri, setTauri] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    setTauri(isTauriEnvironment());
  }, []);

  useEffect(() => {
    if (!tauri) return;
    let cancelled = false;

    async function refresh() {
      try {
        const m = await isMaximized();
        if (!cancelled) setMaximized(m);
      } catch {
        // ignore
      }
    }
    void refresh();

    const onResize = () => void refresh();
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
    };
  }, [tauri]);

  const onBrandClick = () => {
    openCollection();
  };

  const onTitleMouseDown = (e: React.MouseEvent) => {
    if (!tauri) return;
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    void startDragging();
  };

  return (
    <header
      className="bg-surface text-fg-body border-b border-border-default flex h-10 shrink-0 items-center justify-between select-none"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Brand (left) — also draggable */}
      <div
        className="flex h-full flex-1 cursor-pointer items-center gap-2.5 px-4"
        onMouseDown={onTitleMouseDown}
        onClick={onBrandClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onBrandClick();
          }
        }}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <VinylMark />
        <div className="flex flex-col leading-none">
          <span className="text-fg-heading text-sm font-semibold tracking-tight">Vinylly</span>
          <span className="text-fg-body-subtle text-[10px]">Каталог аудио-коллекции</span>
        </div>
      </div>

      {/* Center — drag region */}
      <div
        className="hidden h-full flex-1 md:block"
        onMouseDown={onTitleMouseDown}
        onDoubleClick={() => {
          if (tauri) void toggleMaximize();
        }}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        aria-hidden
      />

      {/* Right — current page indicator + window controls */}
      <div
        className="flex h-full items-center gap-1 px-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="text-fg-body-subtle mr-2 hidden text-xs font-medium uppercase tracking-wide md:inline">
          {pageLabel(page)}
        </span>

        {tauri ? <WindowControls maximized={maximized} /> : null}
      </div>
    </header>
  );
}

function pageLabel(page: string): string {
  switch (page) {
    case 'collection':
      return 'Коллекция';
    case 'add':
      return 'Добавить';
    case 'detail':
      return 'Релиз';
    case 'settings':
      return 'Настройки';
    default:
      return '';
  }
}

function WindowControls({ maximized }: { maximized: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <TitlebarButton onClick={() => void minimizeWindow()} ariaLabel="Свернуть">
        <MinimizeIcon />
      </TitlebarButton>
      <TitlebarButton
        onClick={() => void toggleMaximize()}
        ariaLabel={maximized ? 'Восстановить' : 'Развернуть'}
      >
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
      </TitlebarButton>
      <TitlebarButton onClick={() => void closeWindow()} ariaLabel="Закрыть" variant="danger">
        <CloseIcon />
      </TitlebarButton>
    </div>
  );
}

function TitlebarButton({
  onClick,
  ariaLabel,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  const base =
    'inline-flex h-7 w-9 items-center justify-center rounded-base border border-transparent bg-surface text-fg-body transition-all duration-200 ease-in-out';
  const variantClass =
    variant === 'danger'
      ? 'hover:text-fg-danger-strong hover:bg-danger-soft'
      : 'hover:text-fg-heading';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${base} ${variantClass} hover:shadow-neu-2xs active:shadow-neu-inset`}
    >
      {children}
    </button>
  );
}

function VinylMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className="text-fg-brand h-5 w-5 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.8" fill="var(--color-surface)" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" strokeLinecap="round" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M5 13h14" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <rect x="7" y="7" width="11" height="11" rx="1.5" />
      <path d="M4 16V6a1.5 1.5 0 0 1 1.5-1.5H16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
