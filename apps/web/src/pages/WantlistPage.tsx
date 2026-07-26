import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, PageHeader, Card, EmptyState, SkeletonCard } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useRemoveFromWantlist, useWantlist } from '../lib/queries';
import { useSettings } from '../lib/settings-store';
import { itemRepo } from '../lib/db';
import { getProvidersRegistry } from '../lib/providers';
import { createThrottle } from '../lib/bulk-add';
import type { WantlistEntry } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';
import { BackButton } from '../components/BackButton';
import { ImportProgress } from '../components/ImportProgress';
import { useUndoableDelete } from '../lib/undo-delete';

const GRID_CLASS = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function WantlistPage() {
  const { t } = useTranslation();
  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const showToast = useUi((s) => s.showToast);
  const hideToast = useUi((s) => s.hideToast);
  const { data: entries = [], isLoading } = useWantlist();
  const removeFromWantlist = useRemoveFromWantlist();
  const queryClient = useQueryClient();

  const { schedule, pending, clearPending } = useUndoableDelete<WantlistEntry>(
    useCallback(
      (entry, clear) => {
        removeFromWantlist.mutate(entry.id, {
          onSuccess: () => hideToast(),
          onError: (err) => {
            clear();
            hideToast();
            showToast(t('wantlist:item.remove_error', { error: String(err) }));
          },
        });
      },
      [removeFromWantlist, hideToast, showToast, t],
    ),
  );

  // Clear pending marker once the list confirms the entry is gone (no flash).
  useEffect(() => {
    if (pending && !entries.some((e) => e.id === pending.id)) {
      clearPending();
    }
  }, [entries, pending, clearPending]);

  const onDelete = useCallback(
    (entry: WantlistEntry) => {
      schedule(entry, t('wantlist:item.removed_undo', { title: entry.release.title }));
    },
    [schedule, t],
  );

  /* ─── Price watch refresh ─── */
  const discogsEnabled = useSettings((s) => Boolean(s.discogsToken));
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const onRefreshPrices = useCallback(async () => {
    const registry = getProvidersRegistry();
    if (!registry.discogs?.isEnabled()) {
      showToast(t('stats:refresh.discogs_required'));
      return;
    }
    const targets = entries.filter((e) => e.release.source === 'discogs' && e.release.sourceId);
    if (!targets.length) {
      showToast(t('stats:refresh.no_targets'));
      return;
    }
    setRefreshing(true);
    setProgress({ done: 0, total: targets.length });
    const throttle = createThrottle(1100);
    let updated = 0;
    let failed = 0;
    for (const entry of targets) {
      await throttle();
      try {
        const fresh = await registry.discogs.getRelease(entry.release.sourceId);
        if (fresh && (fresh.lowestPrice != null || fresh.numForSale != null)) {
          await itemRepo.setReleaseMarketData(entry.release.id, {
            lowestPrice: fresh.lowestPrice ?? null,
            numForSale: fresh.numForSale ?? null,
          });
          updated++;
        }
      } catch {
        failed++;
      }
      setProgress({ done: updated + failed, total: targets.length });
    }
    await queryClient.invalidateQueries({ queryKey: ['wantlist'] });
    setRefreshing(false);
    setProgress(null);
    showToast(
      failed > 0
        ? t('stats:refresh.done_with_failures', { updated, total: targets.length, failed })
        : t('stats:refresh.done', { updated, total: targets.length }),
    );
  }, [entries, queryClient, showToast, t]);

  const visible = pending ? entries.filter((e) => e.id !== pending.id) : entries;

  return (
    <section className="animate-rise">
      <PageHeader
        level="h1"
        title={t('wantlist:page.title')}
        subtitle={
          entries.length === 0
            ? t('wantlist:page.subtitle_empty')
            : t('wantlist:page.subtitle', { count: entries.length })
        }
        actions={
          <>
            <BackButton onClick={openCollection} label={t('common:button.back')} />
            <Button
              variant="neutral"
              size="sm"
              onClick={() => void onRefreshPrices()}
              disabled={refreshing || !discogsEnabled || !entries.length}
              leftIcon={<RefreshIcon />}
            >
              {refreshing && progress
                ? `${progress.done}/${progress.total}`
                : t('wantlist:prices.refresh')}
            </Button>
            <Button variant="brand" size="sm" onClick={() => openAdd()} leftIcon={<PlusIcon />}>
              {t('wantlist:page.add_button')}
            </Button>
          </>
        }
      />

      {progress ? <ImportProgress done={progress.done} total={progress.total} className="mb-4" /> : null}

      {isLoading ? (
        <ul className={GRID_CLASS}>
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <SkeletonCard />
            </li>
          ))}
        </ul>
      ) : visible.length === 0 && !pending ? (
        <EmptyState
          title={t('wantlist:empty.title')}
          description={t('wantlist:empty.suggestion')}
          action={
            <Button variant="brand" onClick={() => openAdd()}>
              {t('wantlist:empty.add_button')}
            </Button>
          }
        />
      ) : visible.length === 0 && pending ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-fg-body-subtle text-sm">{t('common:loading.generic')}</p>
        </div>
      ) : (
        <ul className={GRID_CLASS}>
          {visible.map((entry, i) => (
            <li key={entry.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <WantlistTile entry={entry} onDelete={() => onDelete(entry)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WantlistTile({ entry, onDelete }: { entry: WantlistEntry; onDelete: () => void }) {
  const { t } = useTranslation();
  const openReleasePreview = useUi((s) => s.openReleasePreview);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const price = entry.release.lowestPrice;
  const target = entry.targetPrice ?? null;
  const priceTone =
    price != null && target != null
      ? price <= target
        ? 'text-fg-success-strong'
        : 'text-fg-warning'
      : 'text-fg-heading';

  return (
    <Card variant="interactive" as="div" className="group relative h-full w-full overflow-hidden p-0 text-left">
      <button
        type="button"
        onClick={handleDelete}
        className="text-fg-danger hover:text-fg-danger-strong hover:shadow-neu-2xs absolute right-2 top-2 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full opacity-0 transition-[box-shadow,color,opacity] duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        aria-label={t('wantlist:item.remove_aria')}
      >
        <TrashIcon />
      </button>
      {price != null ? (
        <span
          className={`rounded-base bg-surface shadow-neu-sm absolute left-2 top-2 z-10 px-2 py-1 text-xs font-semibold ${priceTone}`}
          title={
            target != null
              ? t('wantlist:prices.vs_target', { target: `$${target.toFixed(2)}` })
              : undefined
          }
        >
          ${price.toFixed(2)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => openReleasePreview(entry.release.id)}
        className="flex h-full flex-col p-5 text-left"
        aria-label={t('wantlist:item.open_aria', { title: entry.release.title })}
      >
        <div className="rounded-base shadow-neu-inset aspect-square overflow-hidden">
          <CoverImage
            releaseId={entry.release.id}
            coverPath={entry.release.coverPath}
            coverRemote={entry.release.coverRemote}
            alt={t('collection:item.cover_alt', { title: entry.release.title })}
            size="thumb"
          />
        </div>
        <div className="flex flex-1 flex-col justify-end pt-5">
          {entry.release.year ? (
            <div className="text-fg-body-subtle text-xs">{entry.release.year}</div>
          ) : null}
          <h3 className="text-fg-heading mt-1 line-clamp-1 text-base font-semibold leading-tight">
            {entry.release.title}
          </h3>
          <p className="text-fg-body-subtle mt-1 line-clamp-1 text-sm leading-relaxed">
            {entry.release.artist}
          </p>
          <p className="text-fg-body-subtle mt-1 text-xs">
            {entry.release.numForSale != null
              ? t('wantlist:prices.for_sale', { count: entry.release.numForSale })
              : null}
            {target != null ? ` · ${t('wantlist:prices.target', { price: `$${target.toFixed(2)}` })}` : ''}
          </p>
          {entry.notes ? (
            <p className="text-fg-body-subtle mt-2 line-clamp-2 text-xs italic">{entry.notes}</p>
          ) : null}
        </div>
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

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" strokeLinecap="round" strokeLinejoin="round" />
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
