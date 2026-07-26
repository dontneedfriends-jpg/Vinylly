import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  SkeletonCard,
  EmptyState,
  Button,
  PageHeader,
  SegmentedControl,
} from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useSettings } from '../lib/settings-store';
import { useItems, useRemoveItem } from '../lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { ItemRecord } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';
import { getProvidersRegistry } from '../lib/providers';
import { useUndoableDelete } from '../lib/undo-delete';
import { useTypeLabels } from '../lib/type-labels';

export function CollectionPage() {
  const { t } = useTranslation();
  const search = useUi((s) => s.search);
  const filterType = useUi((s) => s.filterType);
  const sort = useUi((s) => s.sort);
  const viewMode = useUi((s) => s.viewMode);
  const setViewMode = useUi((s) => s.setViewMode);
  const openDetail = useUi((s) => s.openDetail);
  const openAdd = useUi((s) => s.openAdd);
  const showToast = useUi((s) => s.showToast);
  const hideToast = useUi((s) => s.hideToast);

  const typeLabels = useTypeLabels();

  const filterTags = useUi((s) => s.filterTags);
  const discogsUsername = useSettings((s) => s.discogsUsername);
  const discogsSyncEnabled = useSettings((s) => s.discogsSyncEnabled);

  const filter = useMemo(
    () => ({
      type: filterType === 'all' ? undefined : filterType,
      search: search || undefined,
      tags: filterTags.length ? filterTags : undefined,
      sort,
    }),
    [filterType, search, filterTags, sort],
  );

  const { data: items = [], isLoading } = useItems(filter);
  // Unfiltered pool — used to detect when a scheduled item is actually gone from the DB
  const { data: allItems = [] } = useItems({});
  const removeItem = useRemoveItem();
  const queryClient = useQueryClient();

  const syncDiscogsDelete = useCallback(
    (snapshot: ItemRecord | null | undefined) => {
      if (!discogsUsername || !discogsSyncEnabled || !snapshot) return;
      if (snapshot.release.source !== 'discogs' || snapshot.discogsInstanceId == null) return;
      const registry = getProvidersRegistry();
      void registry.removeFromDiscogsCollection(
        discogsUsername,
        Number(snapshot.release.sourceId),
        snapshot.discogsInstanceId,
      );
    },
    [discogsUsername, discogsSyncEnabled],
  );

  const { schedule, pending, clearPending } = useUndoableDelete<ItemRecord>(
    useCallback(
      (item, clear) => {
        removeItem.mutate(item.id, {
          onSuccess: () => {
            hideToast();
            void queryClient.invalidateQueries({ queryKey: ['items'] });
            void queryClient.invalidateQueries({ queryKey: ['item', item.id] });
            syncDiscogsDelete(item);
          },
          onError: (err) => {
            clear();
            hideToast();
            showToast(t('collection:item.delete_error', { error: String(err) }));
          },
        });
      },
      [removeItem, hideToast, showToast, queryClient, syncDiscogsDelete, t],
    ),
  );

  const displayedItems = useMemo(
    () => (pending ? items.filter((it) => it.id !== pending.id) : items),
    [items, pending],
  );

  // Clear pending marker only after the unfiltered list confirms item is gone (no flash)
  useEffect(() => {
    if (pending && !allItems.some((it) => it.id === pending.id)) {
      clearPending();
    }
  }, [allItems, pending, clearPending]);

  const onDelete = useCallback(
    (item: ItemRecord) => {
      schedule(item, t('collection:item.deleted_undo', { title: item.release.title }));
    },
    [schedule, t],
  );

  return (
    <section className="animate-rise">
      <PageHeader level="h1"
        title={t('collection:page.title')}
        subtitle={
          displayedItems.length === 0 && !isLoading
            ? t('collection:page.subtitle')
            : `${displayedItems.length} ${t('collection:page.subtitle')}`
        }
        actions={
          <div className="flex items-center gap-3">
            <SegmentedControl
              value={viewMode}
              onChange={setViewMode}
              ariaLabel={t('collection:page.view_mode_aria')}
              className="hidden sm:inline-flex"
              options={[
                { value: 'grid', label: t('collection:page.view_grid'), icon: <GridViewIcon /> },
                { value: 'list', label: t('collection:page.view_list'), icon: <ListViewIcon /> },
              ]}
            />
            <Button onClick={() => openAdd()} leftIcon={<PlusIcon />}>
              {t('collection:page.add_button')}
            </Button>
          </div>
        }
      />

      {/* ─── Grid/List ─── */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <SkeletonCard />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-rise rounded-base border-border-default bg-surface shadow-neu-2xs h-16 border" style={{ animationDelay: `${i * 40}ms` }} />
            ))}
          </div>
        )
      ) : displayedItems.length === 0 && !pending ? (
        <EmptyState
          title={t('collection:empty.title')}
          description={t('collection:empty.suggestion')}
          action={
            <Button onClick={() => openAdd()} variant="brand">
              {t('collection:empty.add_release')}
            </Button>
          }
        />
      ) : displayedItems.length === 0 && pending ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-fg-body-subtle text-sm">{t('common:loading.generic')}</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-3">
          {displayedItems.map((it, i) => (
            <div
              key={it.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <ListItemTile item={it} onOpen={() => openDetail(it.id)} typeLabels={typeLabels} onDelete={() => onDelete(it)} />
            </div>
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedItems.map((it, i) => (
            <li
              key={it.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <ItemTile item={it} onOpen={() => openDetail(it.id)} typeLabels={typeLabels} onDelete={() => onDelete(it)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemTile({ item, onOpen, typeLabels, onDelete }: { item: ItemRecord; onOpen: () => void; typeLabels: Record<string, string>; onDelete: () => void }) {
  const { t } = useTranslation();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <Card
      variant="interactive"
      as="div"
      className="group relative h-full w-full overflow-hidden p-0 text-left"
    >
      <button
        type="button"
        onClick={handleDelete}
        className="text-fg-danger hover:text-fg-danger-strong hover:shadow-neu-2xs absolute right-2 top-2 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full opacity-0 transition-[box-shadow,color,opacity] duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        aria-label={t('collection:item.delete_aria')}
      >
        <TrashIcon />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col p-5 text-left"
        aria-label={t('collection:item.open_aria', { title: item.release.title })}
      >
        <div className="rounded-base shadow-neu-inset aspect-square overflow-hidden">
          <CoverImage
            releaseId={item.release.id}
            coverPath={item.release.coverPath}
            coverRemote={item.release.coverRemote}
            alt={t('collection:item.cover_alt', { title: item.release.title })}
            size="thumb"
          />
        </div>
        <div className="flex flex-1 flex-col justify-end pt-5">
          <div className="text-fg-body-subtle flex items-center gap-2 text-xs">
            <VinylIcon />
            <span>{typeLabels[item.type]}</span>
            {item.release.year ? <span>· {item.release.year}</span> : null}
          </div>
          <h3 className="text-fg-heading mt-3 line-clamp-1 text-base font-semibold leading-tight">
            {item.release.title}
          </h3>
          <p className="text-fg-body-subtle mt-1 line-clamp-1 text-sm leading-relaxed">
            {item.release.artist}
          </p>
        </div>
      </button>
    </Card>
  );
}

function ListItemTile({ item, onOpen, typeLabels, onDelete }: { item: ItemRecord; onOpen: () => void; typeLabels: Record<string, string>; onDelete: () => void }) {
  const { t } = useTranslation();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <Card
      variant="interactive"
      as="div"
      className="group relative flex w-full items-center gap-4 overflow-hidden p-0 text-left"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3 text-left"
        aria-label={t('collection:item.open_aria', { title: item.release.title })}
      >
        <span className="rounded-base shadow-neu-inset block h-14 w-14 shrink-0 overflow-hidden">
          <CoverImage
            releaseId={item.release.id}
            coverPath={item.release.coverPath}
            coverRemote={item.release.coverRemote}
            alt={t('collection:item.cover_alt', { title: item.release.title })}
            size="thumb"
          />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-4">
          <span className="min-w-0 flex-1">
            <h3 className="text-fg-heading truncate text-sm font-semibold leading-tight">
              {item.release.title}
            </h3>
            <p className="text-fg-body-subtle mt-0.5 truncate text-xs leading-relaxed">
              {item.release.artist}
            </p>
          </span>
          <span className="text-fg-body-subtle hidden items-center gap-2 text-xs sm:flex">
            <VinylIcon />
            <span>{typeLabels[item.type]}</span>
            {item.release.year ? <span>· {item.release.year}</span> : null}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="text-fg-danger hover:text-fg-danger-strong hover:shadow-neu-2xs mr-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full opacity-0 transition-[box-shadow,color,opacity] duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        aria-label={t('collection:item.delete_aria')}
      >
        <TrashIcon />
      </button>
    </Card>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function GridViewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="16" width="18" height="4" rx="1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VinylIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}
