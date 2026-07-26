import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { itemRepo } from '../lib/db';
import { CoverImage } from '../components/CoverImage';
import { getProvidersRegistry } from '../lib/providers';
import { useUndoableDelete } from '../lib/undo-delete';
import { useTypeLabels } from '../lib/type-labels';
import { RandomPickModal, DiceIcon } from '../components/RandomPickModal';
import { BulkEditBar, type BulkEditPatch } from '../components/BulkEditBar';

export function CollectionPage() {
  const { t } = useTranslation();
  const search = useUi((s) => s.search);
  const filterType = useUi((s) => s.filterType);
  const sort = useUi((s) => s.sort);
  const viewMode = useUi((s) => s.viewMode);
  const setViewMode = useUi((s) => s.setViewMode);
  const showTileStatus = useUi((s) => s.showTileStatus);
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

  /** Copy counts per release — drives the ×N badge on tiles. */
  const copiesByRelease = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of allItems) {
      map.set(it.release.id, (map.get(it.release.id) ?? 0) + 1);
    }
    return map;
  }, [allItems]);

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

  /* ─── Random pick ─── */
  const [randomOpen, setRandomOpen] = useState(false);

  /* ─── Bulk edit ─── */
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelecting = useCallback(() => {
    setSelecting((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onBulkApply = useCallback(
    async (patch: BulkEditPatch) => {
      setBulkBusy(true);
      try {
        const byId = new Map(allItems.map((it) => [it.id, it]));
        for (const id of selectedIds) {
          const item = byId.get(id);
          if (!item) continue;
          const data: Record<string, unknown> = {};
          if (patch.location) data.location = patch.location;
          if (patch.sleeveCondition) data.sleeveCondition = patch.sleeveCondition;
          if (patch.mediaCondition) data.mediaCondition = patch.mediaCondition;
          if (patch.addTag) {
            data.tags = [...new Set([...(item.tags ?? []), patch.addTag])];
          }
          if (Object.keys(data).length) await itemRepo.update(id, data);
        }
        await queryClient.invalidateQueries({ queryKey: ['items'] });
        showToast(t('collection:bulk_edit.done', { count: selectedIds.size }));
        setSelecting(false);
        setSelectedIds(new Set());
      } catch (err) {
        showToast(t('collection:bulk_edit.error', { error: String(err) }));
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedIds, allItems, queryClient, showToast, t],
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
          <>
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
            <Button
              variant="neutral"
              size="sm"
              onClick={() => setRandomOpen(true)}
              disabled={!items.length}
              leftIcon={<DiceIcon />}
            >
              {t('collection:random.button')}
            </Button>
            <Button variant={selecting ? 'secondary' : 'neutral'} size="sm" onClick={toggleSelecting}>
              {selecting ? t('collection:bulk_edit.cancel_select') : t('collection:bulk_edit.select')}
            </Button>
            <Button size="sm" onClick={() => openAdd()} leftIcon={<PlusIcon />}>
              {t('collection:page.add_button')}
            </Button>
          </>
        }
      />

      {/* ─── Grid/List ─── */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <ListItemTile
                item={it}
                onOpen={() => (selecting ? toggleSelect(it.id) : openDetail(it.id))}
                typeLabels={typeLabels}
                onDelete={() => onDelete(it)}
                selecting={selecting}
                selected={selectedIds.has(it.id)}
                showStatus={showTileStatus}
                copiesCount={copiesByRelease.get(it.release.id) ?? 1}
              />
            </div>
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedItems.map((it, i) => (
            <li
              key={it.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <ItemTile
                item={it}
                onOpen={() => (selecting ? toggleSelect(it.id) : openDetail(it.id))}
                typeLabels={typeLabels}
                onDelete={() => onDelete(it)}
                selecting={selecting}
                selected={selectedIds.has(it.id)}
                showStatus={showTileStatus}
                copiesCount={copiesByRelease.get(it.release.id) ?? 1}
              />
            </li>
          ))}
        </ul>
      )}

      <RandomPickModal open={randomOpen} items={items} onClose={() => setRandomOpen(false)} />
      {selecting ? (
        <BulkEditBar
          count={selectedIds.size}
          busy={bulkBusy}
          onApply={(patch) => void onBulkApply(patch)}
          onCancel={toggleSelecting}
        />
      ) : null}
    </section>
  );
}

function ItemTile({
  item,
  onOpen,
  typeLabels,
  onDelete,
  selecting = false,
  selected = false,
  showStatus = false,
  copiesCount = 1,
}: {
  item: ItemRecord;
  onOpen: () => void;
  typeLabels: Record<string, string>;
  onDelete: () => void;
  selecting?: boolean;
  selected?: boolean;
  showStatus?: boolean;
  copiesCount?: number;
}) {
  const { t } = useTranslation();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <Card
      variant="interactive"
      as="div"
      className={`group relative h-full w-full overflow-hidden p-0 text-left ${
        selected ? 'shadow-neu-inset' : ''
      }`}
    >
      {selecting ? (
        <span
          aria-hidden
          className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-neu ${
            selected
              ? 'bg-brand-soft border-border-brand text-fg-brand-strong'
              : 'bg-surface border-border-default-medium text-transparent shadow-neu-2xs'
          }`}
        >
          <CheckSmallIcon />
        </span>
      ) : (
        <>
          {item.lentTo ? (
            <span
              className="rounded-base bg-warning-soft text-fg-warning absolute left-2 top-2 z-10 max-w-[70%] truncate px-2 py-1 text-xs font-medium shadow-neu-2xs"
              title={t('detail:loan.badge', { name: item.lentTo })}
            >
              {item.lentTo}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleDelete}
            className="text-fg-danger hover:text-fg-danger-strong hover:shadow-neu-2xs absolute right-2 top-2 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full opacity-0 transition-[box-shadow,color,opacity] duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
            aria-label={t('collection:item.delete_aria')}
          >
            <TrashIcon />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col p-5 text-left"
        aria-label={t('collection:item.open_aria', { title: item.release.title })}
        aria-pressed={selecting ? selected : undefined}
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
            {copiesCount > 1 ? (
              <span className="text-fg-brand font-medium" title={t('collection:tile.copies', { count: copiesCount })}>
                · ×{copiesCount}
              </span>
            ) : null}
            {item.mediaCondition ? (
              <span
                className={`rounded-sm px-1.5 py-0.5 font-semibold shadow-neu-inset ${conditionTone(item.mediaCondition)}`}
                title={
                  [item.sleeveCondition && t('collection:tile.sleeve', { c: item.sleeveCondition }),
                  t('collection:tile.media', { c: item.mediaCondition })]
                    .filter(Boolean)
                    .join(' · ')
                }
              >
                {item.mediaCondition}
              </span>
            ) : null}
          </div>
          <h3 className="text-fg-heading mt-3 line-clamp-1 text-base font-semibold leading-tight">
            {item.release.title}
          </h3>
          <p className="text-fg-body-subtle mt-1 line-clamp-1 text-sm leading-relaxed">
            {item.release.artist}
          </p>
          {showStatus ? <TileStatus item={item} /> : null}
        </div>
      </button>
    </Card>
  );
}

function conditionTone(condition: string | null): string {
  if (!condition) return '';
  if (condition === 'M' || condition === 'NM') return 'text-fg-success-strong';
  if (condition === 'VG+' || condition === 'VG') return 'text-fg-brand';
  return 'text-fg-warning';
}

function TileStatus({ item, className = '' }: { item: ItemRecord; className?: string }) {
  const { t } = useTranslation();
  const condition = [item.sleeveCondition, item.mediaCondition].filter(Boolean).join('/');
  return (
    <p className={`mt-1 flex flex-wrap items-center gap-x-2 text-xs leading-relaxed ${className}`}>
      {item.purchasePrice != null ? (
        <span className="text-fg-body-subtle tabular-nums">${item.purchasePrice.toFixed(2)}</span>
      ) : (
        <span className="text-fg-warning">{t('collection:tile.no_price')}</span>
      )}
      {item.location ? (
        <span className="text-fg-body-subtle max-w-full truncate">· {item.location}</span>
      ) : (
        <span className="text-fg-warning">· {t('collection:tile.no_location')}</span>
      )}
      {condition ? <span className="text-fg-body-subtle">· {condition}</span> : null}
    </p>
  );
}

function ListItemTile({
  item,
  onOpen,
  typeLabels,
  onDelete,
  selecting = false,
  selected = false,
  showStatus = false,
  copiesCount = 1,
}: {
  item: ItemRecord;
  onOpen: () => void;
  typeLabels: Record<string, string>;
  onDelete: () => void;
  selecting?: boolean;
  selected?: boolean;
  showStatus?: boolean;
  copiesCount?: number;
}) {
  const { t } = useTranslation();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <Card
      variant="interactive"
      as="div"
      className={`group relative flex w-full items-center gap-4 overflow-hidden p-0 text-left ${
        selected ? 'shadow-neu-inset' : ''
      }`}
    >
      {selecting ? (
        <span
          aria-hidden
          className={`ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-neu ${
            selected
              ? 'bg-brand-soft border-border-brand text-fg-brand-strong'
              : 'bg-surface border-border-default-medium text-transparent shadow-neu-2xs'
          }`}
        >
          <CheckSmallIcon />
        </span>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3 text-left"
        aria-label={t('collection:item.open_aria', { title: item.release.title })}
        aria-pressed={selecting ? selected : undefined}
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
            {showStatus ? <TileStatus item={item} /> : null}
          </span>
          <span className="text-fg-body-subtle hidden items-center gap-2 text-xs sm:flex">
            <VinylIcon />
            <span>{typeLabels[item.type]}</span>
            {item.release.year ? <span>· {item.release.year}</span> : null}
            {copiesCount > 1 ? (
              <span className="text-fg-brand font-medium" title={t('collection:tile.copies', { count: copiesCount })}>
                · ×{copiesCount}
              </span>
            ) : null}
            {item.mediaCondition ? (
              <span
                className={`rounded-sm px-1.5 py-0.5 font-semibold shadow-neu-inset ${conditionTone(item.mediaCondition)}`}
                title={
                  [item.sleeveCondition && t('collection:tile.sleeve', { c: item.sleeveCondition }),
                  t('collection:tile.media', { c: item.mediaCondition })]
                    .filter(Boolean)
                    .join(' · ')
                }
              >
                {item.mediaCondition}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {!selecting ? (
        <button
          type="button"
          onClick={handleDelete}
          className="text-fg-danger hover:text-fg-danger-strong hover:shadow-neu-2xs mr-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full opacity-0 transition-[box-shadow,color,opacity] duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
          aria-label={t('collection:item.delete_aria')}
        >
          <TrashIcon />
        </button>
      ) : null}
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

function CheckSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="h-3.5 w-3.5" aria-hidden>
      <path d="M6 12l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
