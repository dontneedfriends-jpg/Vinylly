import type { ReactNode } from 'react';
import { useUi } from '../lib/ui-store';

export interface LayoutProps {
  children?: ReactNode;
}

const navItems: Array<{ id: 'collection' | 'add' | 'search'; label: string }> = [
  { id: 'collection', label: 'Коллекция' },
  { id: 'add', label: 'Добавить' },
  { id: 'search', label: 'Поиск' },
];

export function Layout({ children }: LayoutProps) {
  const page = useUi((s) => s.page);
  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const openSearch = useUi((s) => s.openSearch);

  const active = page === 'detail' ? 'collection' : page;

  return (
    <div className="bg-surface text-fg-body min-h-full">
      <div className="mx-auto w-full max-w-[1140px] px-6 py-8">
        <header className="mb-12 flex items-center justify-between">
          <button
            type="button"
            onClick={openCollection}
            className="cursor-pointer border-0 bg-transparent p-0 text-left"
          >
            <h1 className="text-fg-heading">Vinylly</h1>
            <p className="text-fg-body-subtle text-sm">
              Каталог винила, CD, кассет и других носителей
            </p>
          </button>
          <nav aria-label="Главная навигация" className="flex gap-2">
            {navItems.map((it) => {
              const isActive = active === it.id;
              const onClick =
                it.id === 'collection'
                  ? openCollection
                  : it.id === 'add'
                    ? openAdd
                    : () => openSearch();
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={onClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    'rounded-base px-4 py-2 text-sm font-medium ' +
                    'border transition-all duration-200 ease-in-out' +
                    (isActive
                      ? 'bg-surface border-border-default text-fg-heading shadow-neu-inset'
                      : 'bg-surface border-border-default text-fg-body shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset')
                  }
                >
                  {it.label}
                </button>
              );
            })}
          </nav>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
