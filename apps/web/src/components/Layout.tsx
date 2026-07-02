import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '../lib/ui-store';
import { Card } from '@vinylly/ui';
import { ThemeToggle } from './ThemeToggle';
import { RightRail } from './RightRail';
import { Titlebar } from './Titlebar';

export interface LayoutProps {
  children?: ReactNode;
}

type NavId = 'collection' | 'add' | 'settings';

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const page = useUi((s) => s.page);
  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const openSettings = useUi((s) => s.openSettings);

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

  const active: NavId = page === 'detail' ? 'collection' : (page as NavId);

  const onClick = (id: NavId) => {
    if (id === 'collection') return openCollection();
    if (id === 'add') return openAdd();
    return openSettings();
  };

  return (
    <div className="bg-surface text-fg-body flex h-screen min-h-full flex-col overflow-hidden">
      <Titlebar />

      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1280px] gap-0 px-4 py-4 sm:px-6 sm:py-6">
          {/* ─── Sidebar ─── */}
          <Card
            as="aside"
            role="navigation"
            aria-label={t('layout:nav.aria')}
            className="mr-4 flex h-[calc(100vh-3rem)] w-16 shrink-0 flex-col overflow-hidden transition-all duration-200 ease-in-out sm:mr-6 sm:h-[calc(100vh-3.5rem)] xl:w-64"
          >
            <nav className="scrollbar-neu flex flex-1 flex-col gap-1 overflow-y-auto px-2 pt-5 xl:px-3">
              {navItems.map((it) => {
                const isActive = active === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onClick(it.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={it.label}
                    className={
                      'group relative rounded-base flex items-center justify-center gap-3 border px-2 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out xl:justify-start xl:px-3 ' +
                      (isActive
                        ? 'bg-surface text-fg-brand-strong shadow-neu-inset border-transparent'
                        : 'bg-surface text-fg-body hover:text-fg-heading hover:shadow-neu-sm border-transparent')
                    }
                  >
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${isActive ? 'text-fg-brand' : ''}`}
                    >
                      {it.icon}
                    </span>
                    <span className="hidden xl:inline">{it.label}</span>
                    <span className="xl:hidden rounded-base bg-surface text-fg-body shadow-neu-md pointer-events-none invisible absolute left-full ml-2 whitespace-nowrap px-2 py-1 text-xs font-medium opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                      {it.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="flex shrink-0 flex-col gap-3 px-2 py-4 xl:px-3">
              <ThemeToggle />
            </div>
          </Card>

          {/* ─── Main frame ─── */}
          <main className="rounded-base border-border-default bg-surface shadow-neu-md flex h-[calc(100vh-3rem)] min-w-0 flex-1 flex-col overflow-hidden border sm:h-[calc(100vh-3.5rem)]">
            <div className="scrollbar-neu min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8 sm:py-10 md:px-10">
              {children}
            </div>
          </main>

          {/* ─── Right rail (contextual) ─── */}
          <div className="ml-0 shrink-0 transition-all duration-200 ease-in-out lg:ml-6">
            <RightRail />
          </div>
        </div>
      </div>
    </div>
  );
}
