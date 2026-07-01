import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  SkeletonCard,
  EmptyState,
  Button,
  PageHeader,
} from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItems, useRemoveItem } from '../lib/queries';
import type { MediaType, ItemRecord } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';

export function CollectionPage() {
  const { t } = useTranslation();
  const search = useUi((s) => s.search);
  const filterType = useUi((s) => s.filterType);
  const sort = useUi((s) => s.sort);
  const openDetail = useUi((s) => s.openDetail);
  const openAdd = useUi((s) => s.openAdd);

  const typeLabels: Record<MediaType, string> = {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };

  const filter = useMemo(
    () => ({
      type: filterType === 'all' ? undefined : filterType,
      search: search || undefined,
      sort,
    }),
    [filterType, search, sort],
  );

  const { data: items = [], isLoading } = useItems(filter);

  return (
    <section className="animate-rise">
      <PageHeader
        title={t('collection:page.title')}
        subtitle={
          items.length === 0 && !isLoading
            ? t('collection:page.subtitle')
            : `${items.length} ${t('collection:page.subtitle')}`
        }
        actions={
          <Button onClick={() => openAdd()} leftIcon={<PlusIcon />}>
            {t('collection:page.add_button')}
          </Button>
        }
      />

      {/* ─── Grid ─── */}
      {isLoading ? (
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <SkeletonCard />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('collection:empty.title')}
          description={t('collection:empty.suggestion')}
          action={
            <Button onClick={() => openAdd()} variant="brand">
              {t('collection:empty.add_release')}
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {items.map((it, i) => (
            <li
              key={it.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <ItemTile item={it} onOpen={() => openDetail(it.id)} typeLabels={typeLabels} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemTile({ item, onOpen, typeLabels }: { item: ItemRecord; onOpen: () => void; typeLabels: Record<string, string> }) {
  const { t } = useTranslation();
  const removeItem = useRemoveItem();
  const [deleting, setDeleting] = useState(false);

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`${t('collection:item.delete_aria')} «${item.release.title}»?`)) return;
    setDeleting(true);
    removeItem.mutate(item.id);
  };

  return (
    <Card
      variant="interactive"
      as="div"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      className="group relative h-full w-full overflow-hidden text-left"
    >
      {deleting ? (
        <div className="bg-surface/80 absolute inset-0 z-10 flex items-center justify-center">
          <span className="text-fg-body-subtle text-sm">{t('common:loading.generic')}</span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        className="hover:bg-danger-soft text-fg-danger absolute right-3 top-3 z-10 rounded-full p-2 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={t('collection:item.delete_aria')}
      >
        <TrashIcon />
      </button>
      <div className="p-5">
        <div className="rounded-base shadow-neu-inset aspect-square overflow-hidden">
          <CoverImage
            releaseId={item.release.id}
            coverPath={item.release.coverPath}
            coverRemote={item.release.coverRemote}
            alt={t('collection:item.cover_alt', { title: item.release.title })}
            size="thumb"
          />
        </div>
        <div className="pt-5">
          <div className="text-fg-body-subtle flex items-center gap-2 text-xs">
            <VinylIcon />
            <span>{typeLabels[item.type]}</span>
            {item.release.year ? <span>· {item.release.year}</span> : null}
          </div>
          <h3 className="text-fg-heading mt-3 pl-3 text-base font-semibold leading-tight">
            {item.release.title}
          </h3>
          <p className="text-fg-body-subtle mt-2 pl-3 text-sm leading-relaxed">
            {item.release.artist}
          </p>
        </div>
      </div>
    </Card>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VinylIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}
