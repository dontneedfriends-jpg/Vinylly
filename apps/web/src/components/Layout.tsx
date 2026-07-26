import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '../lib/ui-store';
import { ThemeToggle } from './ThemeToggle';
import { RightRail } from './RightRail';
import { Titlebar } from './Titlebar';
import { ProfileSwitcher } from './ProfileSwitcher';
import { VinylMark } from './VinylMark';

export interface LayoutProps {
  children?: ReactNode;
}

type NavId = 'collection' | 'add' | 'wantlist' | 'stats' | 'settings';

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const page = useUi((s) => s.page);
  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const openSettings = useUi((s) => s.openSettings);
  const openStats = useUi((s) => s.openStats);
  const openWantlist = useUi((s) => s.openWantlist);

  const navItems: Array<{ id: NavId; label: string; icon: ReactNode }> = [
    {
      id: 'collection',
      label: t('layout:nav.collection'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 shrink-0 block" aria-hidden>
          <path d="M6 4h12v16H6z" strokeLinejoin="round" />
          <path d="M6 8h12M6 12h12M6 16h12" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'add',
      label: t('layout:nav.add'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 shrink-0 block" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'wantlist',
      label: t('layout:nav.wantlist'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 shrink-0 block" aria-hidden>
          <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'stats',
      label: t('layout:nav.stats'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 shrink-0 block" aria-hidden>
          <path d="M4 20h16M6 16V9M10 16V5M14 16v-5M18 16V8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: t('layout:nav.settings'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 shrink-0 block" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      ),
    },
  ];

  const active: NavId =
    page === 'detail' || page === 'artist'
      ? 'collection'
      : page === 'stats'
        ? 'stats'
        : page === 'wantlist'
          ? 'wantlist'
          : (page as NavId);

  const onClick = (id: NavId) => {
    if (id === 'collection') return openCollection();
    if (id === 'add') return openAdd();
    if (id === 'wantlist') return openWantlist();
    if (id === 'stats') return openStats();
    return openSettings();
  };

  return (
    <div className="bg-surface text-fg-body flex h-screen min-h-full flex-col overflow-hidden">
      <Titlebar />

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* ─── Sidebar ─── */}
        <aside
          role="navigation"
          aria-label={t('layout:nav.aria')}
          className="rounded-base bg-surface shadow-neu-md flex w-56 shrink-0 flex-col gap-4 overflow-y-auto p-4"
        >
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-2 py-1">
            <VinylMark className="text-fg-brand h-5 w-5 shrink-0" />
            <span className="text-fg-heading text-sm font-semibold tracking-tight">Vinylly</span>
          </div>

          {/* Profile switcher */}
          <ProfileSwitcher />

          {/* Navigation */}
          <nav className="rounded-base bg-surface shadow-neu-inset flex flex-1 flex-col gap-1 p-2">
            {navItems.map((it) => {
              const isActive = active === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onClick(it.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium transition-neu ease-out ${
                    isActive
                      ? 'bg-surface text-fg-brand-strong shadow-neu-inset border border-transparent'
                      : 'text-fg-body hover:text-fg-heading hover:shadow-neu-sm border border-transparent'
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${isActive ? 'text-fg-brand' : ''}`}
                  >
                    {it.icon}
                  </span>
                  <span>{it.label}</span>
                </button>
              );
            })}
          </nav>
          <ThemeToggle />
        </aside>

        {/* ─── Content area (main + right rail) ─── */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <main className="scrollbar-neu min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10 md:px-12">
            {children}
          </main>
          {page !== 'settings' ? <RightRail /> : null}
        </div>
      </div>
    </div>
  );
}
