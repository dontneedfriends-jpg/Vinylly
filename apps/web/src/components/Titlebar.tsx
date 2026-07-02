import { useEffect, useState } from 'react';
import { isTauriEnvironment } from '@vinylly/host';
import {
  closeWindow,
  isMaximized,
  minimizeWindow,
  startDragging,
  toggleMaximize,
} from '../lib/window-controls';

export function Titlebar() {
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
      } catch {}
    }
    void refresh();

    const onResize = () => void refresh();
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
    };
  }, [tauri]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!tauri) return;
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    void startDragging();
  };

  return (
    <header
      className="bg-surface flex h-9 shrink-0 select-none items-center border-b border-border-default"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div
        className="h-full flex-1"
        onMouseDown={onMouseDown}
        onDoubleClick={() => {
          if (tauri) void toggleMaximize();
        }}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        aria-hidden
      />
      <div
        className="flex h-full items-center gap-1 px-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {tauri ? <WindowControls maximized={maximized} /> : null}
      </div>
    </header>
  );
}

function WindowControls({ maximized }: { maximized: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <TitlebarButton onClick={() => void minimizeWindow()} ariaLabel="Minimize">
        <MinimizeIcon />
      </TitlebarButton>
      <TitlebarButton
        onClick={() => void toggleMaximize()}
        ariaLabel={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
      </TitlebarButton>
      <TitlebarButton onClick={() => void closeWindow()} ariaLabel="Close" variant="danger">
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

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden>
      <path d="M5 13h14" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden>
      <rect x="7" y="7" width="11" height="11" rx="1.5" />
      <path d="M4 16V6a1.5 1.5 0 0 1 1.5-1.5H16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
