import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, SegmentedControl, useDialogA11y } from '@vinylly/ui';
import { useItems } from '../lib/queries';
import type { MediaType, ItemRecord } from '@vinylly/db';
import { ArtistPackChart } from './ArtistPackChart';
import { CoverImage } from './CoverImage';
import { useUi } from '../lib/ui-store';
import {
  computeAnniversaries,
  computeDecadeBreakdown,
  computeDuplicates,
  computeFormatBreakdown,
  computeHiddenGems,
  computeMostValuable,
  computeRoiLeaders,
  computeValuation,
  type ValuationRow,
  type ValuationSort,
} from '../lib/stats';
import { formatMoney } from '../lib/format';
import { useTypeLabels } from '../lib/type-labels';
import { useChartColors } from '../lib/chart-colors';
import { usePriceRefresh } from '../lib/price-refresh';

export function StatsPanel() {
  const { t, i18n } = useTranslation();
  const { data: items = [] } = useItems({});
  const chartColors = useChartColors();
  const [expanded, setExpanded] = useState<string | null>(null);

  const typeLabels = useTypeLabels();

  const yearEntries = useMemo(() => {
    const yearMap: Record<string, number> = {};
    for (const it of items) {
      const y = it.release.year ? String(it.release.year) : '?';
      yearMap[y] = (yearMap[y] ?? 0) + 1;
    }
    return Object.entries(yearMap).sort(([a], [b]) => (a === '?' ? 1 : b === '?' ? -1 : Number(a) - Number(b)));
  }, [items]);

  const decadeEntries = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      if (!it.release.year) continue;
      const decade = Math.floor(it.release.year / 10) * 10;
      const key = `${decade}s`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b));
  }, [items]);

  const genreEntries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) {
      for (const g of it.release.genres) {
        if (g) counts[g] = (counts[g] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [items]);

  const topValue = useMemo(() => computeMostValuable(items), [items]);
  const topValueFull = useMemo(() => computeMostValuable(items, items.length), [items]);
  const valuation = useMemo(() => computeValuation(items), [items]);
  const missingMarket = useMemo(
    () =>
      items.filter(
        (it) => it.release.source === 'discogs' && it.release.lowestPrice == null,
      ).length,
    [items],
  );
  const { refresh, refreshing, progress, canRefresh } = usePriceRefresh();

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) for (const tag of it.tags) counts[tag] = (counts[tag] ?? 0) + 1;
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [items]);

  const lentItems = useMemo(() => items.filter((it) => it.lentTo), [items]);

  const missing = useMemo(() => {
    let cover = 0;
    let price = 0;
    let notes = 0;
    let location = 0;
    for (const it of items) {
      if (!it.release.coverPath && !it.release.coverRemote) cover++;
      if (it.purchasePrice == null) price++;
      if (!it.notes) notes++;
      if (!it.location) location++;
    }
    const rows = [
      { key: 'cover', labelKey: 'stats:missing.cover', count: cover },
      { key: 'price', labelKey: 'stats:missing.price', count: price },
      { key: 'notes', labelKey: 'stats:missing.notes', count: notes },
      { key: 'location', labelKey: 'stats:missing.location', count: location },
    ];
    return rows.filter((r) => r.count > 0);
  }, [items]);

  const { winners: topWinners, losers: topLosers } = useMemo(
    () => computeRoiLeaders(items),
    [items],
  );
  const hiddenGems = useMemo(() => computeHiddenGems(items), [items]);
  const hiddenGemsFull = useMemo(() => computeHiddenGems(items, items.length), [items]);
  const duplicates = useMemo(() => computeDuplicates(items), [items]);

  const dna = useMemo(() => {
    if (!items.length) return null;
    return {
      decades: computeDecadeBreakdown(items),
      formats: computeFormatBreakdown(items),
      total: items.length,
    };
  }, [items]);

  const anniversaries = useMemo(() => computeAnniversaries(items, new Date().getFullYear()), [items]);
  const anniversariesFull = useMemo(
    () => computeAnniversaries(items, new Date().getFullYear(), items.length),
    [items],
  );

  const topArtistSpend = useMemo(() => {
    const spend: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const it of items) {
      if (it.purchasePrice == null) continue;
      const key = it.release.artist || '—';
      spend[key] = (spend[key] ?? 0) + it.purchasePrice;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(spend)
      .sort(([, a], [, b]) => b - a)
      .map(([artist, total]) => ({ artist, total, count: counts[artist]! }));
  }, [items]);

  const activity = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) {
      if (!it.acquiredAt) continue;
      const ym = it.acquiredAt.slice(0, 7); // YYYY-MM
      counts[ym] = (counts[ym] ?? 0) + 1;
    }
    if (!counts.length) return null;
    const now = new Date();
    const months: Array<{ key: string; count: number; label: string }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(i18n.language, { month: 'short' });
      months.push({ key, count: counts[key] ?? 0, label });
    }
    const max = Math.max(...months.map((m) => m.count), 1);
    return { months, max };
  }, [items, i18n.language]);

  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 ? (
        <EmptyState
          title={t('stats:empty.title')}
          description={t('stats:empty.suggestion')}
          action={
            <Button onClick={() => useUi.getState().openAdd()} variant="brand">
              {t('collection:empty.add_release')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <StatsPanelBlock label={t('layout:rail.collection.by_artist')} span>
            <ArtistPackChart />
          </StatsPanelBlock>

          {valuation.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:valuation.title')}
              span
              expandCount={valuation.length > 10 ? valuation.length : undefined}
              onExpand={() => setExpanded('valuation')}
              headerAction={
                canRefresh ? (
                  <Button
                    size="sm"
                    variant="neutral"
                    onClick={() => void refresh(items)}
                    disabled={refreshing}
                  >
                    {refreshing && progress
                      ? `${progress.done}/${progress.total}`
                      : t('stats:refresh.button')}
                  </Button>
                ) : undefined
              }
            >
              <ValuationTable rows={valuation.slice(0, 10)} />
              {missingMarket > 0 ? (
                <p className="text-fg-body-subtle mt-3 text-xs">
                  {t('stats:valuation.no_market', { count: missingMarket })}
                </p>
              ) : null}
            </StatsPanelBlock>
          ) : null}

          {yearEntries.length > 0 || decadeEntries.length > 0 ? (
            <YearDecadeSection yearEntries={yearEntries} decadeEntries={decadeEntries} />
          ) : null}

          {genreEntries.length > 0 ? (
            <StatsPanelBlock
              label={t('layout:rail.collection.by_genre')}
              expandCount={genreEntries.length > 16 ? genreEntries.length : undefined}
              onExpand={() => setExpanded('genres')}
            >
              <GenreCloud data={genreEntries} max={16} />
            </StatsPanelBlock>
          ) : null}

          {dna ? (
            <StatsPanelBlock label={t('stats:dna.title')}>
              <DnaSection
                title={t('stats:dna.decades')}
                segments={dna.decades.map((d, i) => ({ label: d.label, count: d.count, pct: d.pct, color: chartColors.palette[i % chartColors.palette.length]! }))}
              />
              <DnaSection
                title={t('stats:dna.formats')}
                segments={dna.formats.map((f, i) => ({
                  label: typeLabels[f.label as MediaType] ?? f.label,
                  count: f.count,
                  pct: f.pct,
                  color: chartColors.palette[i % chartColors.palette.length]!,
                }))}
              />
            </StatsPanelBlock>
          ) : null}

          {activity ? (
            <StatsPanelBlock label={t('stats:activity.title')}>
              <div className="grid grid-cols-12 gap-1.5">
                {activity.months.map((m) => {
                  const intensity = m.count === 0 ? 0 : Math.max(0.2, m.count / activity.max);
                  const bg = m.count === 0 ? 'shadow-neu-2xs' : '';
                  return (
                    <div
                      key={m.key}
                      className="flex flex-col items-center gap-1"
                      title={`${m.label} ${m.key}: ${m.count}`}
                    >
                      <div
                        className={`rounded-base h-7 w-full ${bg}`}
                        style={
                          m.count > 0
                            ? { backgroundColor: chartColors.brand(intensity) }
                            : { backgroundColor: chartColors.track }
                        }
                      />
                      <span className="text-fg-body-subtle text-xs">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </StatsPanelBlock>
          ) : null}

          {topTags.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:tags.title')}
              expandCount={topTags.length > 8 ? topTags.length : undefined}
              onExpand={() => setExpanded('tags')}
            >
              <div className="flex flex-wrap gap-1.5">
                {topTags.slice(0, 8).map(([tag, count]) => (
                  <span
                    key={tag}
                    className="rounded-base bg-surface shadow-neu-2xs text-fg-heading inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
                  >
                    <span>{tag}</span>
                    <span className="text-fg-body-subtle">{count}</span>
                  </span>
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}

          {topValue.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:top_value.title')}
              expandCount={topValueFull.length > topValue.length ? topValueFull.length : undefined}
              onExpand={() => setExpanded('topValue')}
            >
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {topValue.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => useUi.getState().openDetail(it.id)}
                    className="hover:shadow-neu-2xs flex w-full items-center gap-3 px-4 py-2 text-left transition-[box-shadow,background-color] duration-200"
                  >
                    <span className="text-fg-body-subtle w-4 shrink-0 text-center text-xs">{i + 1}</span>
                    <span className="rounded-base shadow-neu-2xs bg-surface h-8 w-8 shrink-0 overflow-hidden">
                      <CoverImage
                        releaseId={it.release.id}
                        coverPath={it.release.thumbPath ?? it.release.coverPath}
                        coverRemote={it.release.thumbRemote ?? it.release.coverRemote}
                        alt={it.release.title}
                        size="thumb"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-fg-heading block truncate text-sm font-medium">{it.release.title}</span>
                      <span className="text-fg-body-subtle block truncate text-xs">{it.release.artist}</span>
                    </span>
                    <span className="text-fg-heading shrink-0 text-sm font-semibold">
                      {formatMoney(it.release.lowestPrice ?? 0)}
                    </span>
                  </button>
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}

          {hiddenGems.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:hidden_gems.title')}
              expandCount={hiddenGemsFull.length > hiddenGems.length ? hiddenGemsFull.length : undefined}
              onExpand={() => setExpanded('gems')}
            >
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {hiddenGems.map(({ it, rating, want }) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => useUi.getState().openDetail(it.id)}
                    className="hover:shadow-neu-2xs flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-[box-shadow,background-color] duration-200"
                  >
                    <span className="rounded-base shadow-neu-2xs bg-surface h-8 w-8 shrink-0 overflow-hidden">
                      <CoverImage
                        releaseId={it.release.id}
                        coverPath={it.release.thumbPath ?? it.release.coverPath}
                        coverRemote={it.release.thumbRemote ?? it.release.coverRemote}
                        alt={it.release.title}
                        size="thumb"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-fg-heading block truncate font-medium">{it.release.title}</span>
                      <span className="text-fg-body-subtle block truncate text-xs">{it.release.artist}</span>
                    </span>
                    <span className="text-fg-heading shrink-0 text-xs font-medium">
                      ★ {rating.toFixed(2)}
                      <span className="text-fg-body-subtle ml-2 font-normal">{t('stats:hidden_gems.want', { count: want })}</span>
                    </span>
                  </button>
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}

          {duplicates.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:duplicates.title')}
              expandCount={duplicates.length > 8 ? duplicates.length : undefined}
              onExpand={() => setExpanded('dups')}
            >
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {duplicates.slice(0, 8).map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => useUi.getState().openDetail(g.items[0]!.id)}
                    className="hover:shadow-neu-2xs flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-[box-shadow,background-color] duration-200"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-fg-heading block truncate font-medium">{g.title}</span>
                      <span className="text-fg-body-subtle block truncate text-xs">{g.artist}</span>
                    </span>
                    <span className="text-fg-warning shrink-0 text-xs font-medium">
                      ×{g.items.length}
                      <span className="text-fg-body-subtle ml-2 font-normal">
                        {g.kind === 'master' ? t('stats:duplicates.pressings') : t('stats:duplicates.copies')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}

          {topWinners.length > 0 || topLosers.length > 0 ? (
            <StatsPanelBlock label={t('stats:roi.title')}>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {topWinners.map(({ it, roi }) => (
                  <RoiRow key={`w-${it.id}`} it={it} roi={roi} />
                ))}
                {topLosers.length > 0 && topWinners.length > 0 ? (
                  <div className="bg-surface h-px w-full" />
                ) : null}
                {topLosers.map(({ it, roi }) => (
                  <RoiRow key={`l-${it.id}`} it={it} roi={roi} />
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}

          {anniversaries.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:anniversaries.title')}
              expandCount={anniversariesFull.length > anniversaries.length ? anniversariesFull.length : undefined}
              onExpand={() => setExpanded('anniv')}
            >
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {anniversaries.map(({ it, years }) => {
                  const milestone = years % 10 === 0 || years % 25 === 0;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => useUi.getState().openDetail(it.id)}
                      className="hover:shadow-neu-2xs flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-[box-shadow,background-color] duration-200"
                    >
                      <span className="text-fg-heading shrink-0 text-xs font-semibold">
                        {years}{milestone ? '!' : ''}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-fg-heading block truncate font-medium">{it.release.title}</span>
                        <span className="text-fg-body-subtle block truncate text-xs">
                          {t('stats:anniversaries.since', { year: it.release.year })}
                        </span>
                      </span>
                      <span className="text-fg-body-subtle shrink-0 text-xs">→</span>
                    </button>
                  );
                })}
              </div>
            </StatsPanelBlock>
          ) : null}

          {topArtistSpend.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:artist_spend.title')}
              expandCount={topArtistSpend.length > 5 ? topArtistSpend.length : undefined}
              onExpand={() => setExpanded('spend')}
            >
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {topArtistSpend.slice(0, 5).map(({ artist, total, count }) => (
                  <div key={artist} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-fg-heading min-w-0 truncate">{artist}</span>
                    <span className="text-fg-body-subtle ml-2 shrink-0 text-xs">
                      {formatMoney(total)}
                      <span className="text-fg-body-subtle ml-1.5">· {count}</span>
                    </span>
                  </div>
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}

          {lentItems.length > 0 ? (
            <StatsPanelBlock
              label={t('stats:loans.title')}
              expandCount={lentItems.length > 8 ? lentItems.length : undefined}
              onExpand={() => setExpanded('loans')}
            >
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {lentItems.slice(0, 8).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => useUi.getState().openDetail(it.id)}
                    className="hover:shadow-neu-2xs flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-[box-shadow,background-color] duration-200"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-fg-heading block truncate font-medium">{it.release.title}</span>
                      <span className="text-fg-body-subtle block truncate text-xs">{it.release.artist}</span>
                    </span>
                    <span className="text-fg-warning shrink-0 text-xs font-medium">
                      {t('stats:loans.with', { name: it.lentTo })}
                      {it.lentAt ? (
                        <span className="text-fg-body-subtle ml-1 font-normal">
                          · {new Date(it.lentAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}

          {missing.length > 0 ? (
            <StatsPanelBlock label={t('stats:missing.title')}>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {missing.map((r) => (
                  <div key={r.key} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-fg-body">{t(r.labelKey)}</span>
                    <span className="text-fg-warning text-xs font-medium">
                      {t('stats:missing.count', { count: r.count })}
                    </span>
                  </div>
                ))}
              </div>
            </StatsPanelBlock>
          ) : null}
        </div>
      )}
      {expanded ? (
        <StatsModal
          title={
            expanded === 'genres'
              ? t('layout:rail.collection.by_genre')
              : expanded === 'tags'
                ? t('stats:tags.title')
                : expanded === 'topValue'
                  ? t('stats:top_value.title')
                  : expanded === 'gems'
                    ? t('stats:hidden_gems.title')
                    : expanded === 'dups'
                      ? t('stats:duplicates.title')
                      : expanded === 'anniv'
                        ? t('stats:anniversaries.title')
                        : expanded === 'spend'
                          ? t('stats:artist_spend.title')
                          : expanded === 'valuation'
                            ? t('stats:valuation.title')
                            : t('stats:loans.title')
          }
          wide={expanded === 'valuation'}
          onClose={() => setExpanded(null)}
        >
          {expanded === 'genres' ? <GenreCloud data={genreEntries} max={genreEntries.length} /> : null}
          {expanded === 'tags' ? (
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="rounded-base bg-surface shadow-neu-2xs text-fg-heading inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
                >
                  <span>{tag}</span>
                  <span className="text-fg-body-subtle">{count}</span>
                </span>
              ))}
            </div>
          ) : null}
          {expanded === 'topValue' ? (
            <ModalRows
              rows={topValueFull.map((it) => ({
                id: it.id,
                title: it.release.title,
                subtitle: it.release.artist,
                right: formatMoney(it.release.lowestPrice ?? 0),
                item: it,
              }))}
            />
          ) : null}
          {expanded === 'gems' ? (
            <ModalRows
              rows={hiddenGemsFull.map(({ it, rating, want }) => ({
                id: it.id,
                title: it.release.title,
                subtitle: it.release.artist,
                right: `★ ${rating.toFixed(2)} · ${t('stats:hidden_gems.want', { count: want })}`,
                item: it,
              }))}
            />
          ) : null}
          {expanded === 'dups' ? (
            <ModalRows
              rows={duplicates.map((g) => ({
                id: g.key,
                title: g.title,
                subtitle: g.artist,
                right: `×${g.items.length} ${g.kind === 'master' ? t('stats:duplicates.pressings') : t('stats:duplicates.copies')}`,
                item: g.items[0]!,
              }))}
            />
          ) : null}
          {expanded === 'anniv' ? (
            <ModalRows
              rows={anniversariesFull.map(({ it, years }) => ({
                id: it.id,
                title: it.release.title,
                subtitle: t('stats:anniversaries.since', { year: it.release.year }),
                right: `${years}`,
                item: it,
              }))}
            />
          ) : null}
          {expanded === 'spend' ? (
            <ModalRows
              rows={topArtistSpend.map(({ artist, total, count }) => ({
                id: artist,
                title: artist,
                right: `${formatMoney(total)} · ${count}`,
              }))}
            />
          ) : null}
          {expanded === 'loans' ? (
            <ModalRows
              rows={lentItems.map((it) => ({
                id: it.id,
                title: it.release.title,
                subtitle: it.release.artist,
                right: `${t('stats:loans.with', { name: it.lentTo })}${
                  it.lentAt ? ` · ${new Date(it.lentAt).toLocaleDateString()}` : ''
                }`,
                item: it,
              }))}
            />
          ) : null}
          {expanded === 'valuation' ? (
            <ValuationModal
              items={items}
              missingMarket={missingMarket}
              onRefresh={canRefresh ? () => void refresh(items) : undefined}
              refreshing={refreshing}
              progress={progress}
            />
          ) : null}
        </StatsModal>
      ) : null}
    </div>
  );
}

/* ─── Valuation table ─── */

function roiTone(roi: number | null): string {
  if (roi == null) return 'text-fg-body-subtle';
  return roi >= 0 ? 'text-fg-success-strong' : 'text-fg-danger-strong';
}

function ValuationTable({
  rows,
  sort,
  onSort,
}: {
  rows: ValuationRow[];
  sort?: ValuationSort;
  onSort?: (s: ValuationSort) => void;
}) {
  const { t } = useTranslation();
  const typeLabels = useTypeLabels();
  const Th = ({ k, label, className = '' }: { k?: ValuationSort; label: string; className?: string }) =>
    onSort && k ? (
      <th
        className={`px-3 py-2 font-medium ${className}`}
        aria-sort={sort === k ? 'descending' : undefined}
      >
        <button type="button" onClick={() => onSort(k)} className="hover:text-fg-heading transition-colors">
          {label}
          {sort === k ? ' ↓' : ''}
        </button>
      </th>
    ) : (
      <th className={`px-3 py-2 font-medium ${className}`}>{label}</th>
    );

  return (
    <div className="rounded-base border-border-default bg-surface shadow-neu-inset border overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-8" />
          <col />
          <col className="w-20" />
          <col className="w-14" />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-32" />
        </colgroup>
        <thead>
          <tr className="text-fg-body-subtle border-border-default border-b text-left text-xs">
            <Th label="#" className="text-center" />
            <Th k="title" label={t('stats:valuation.col_title')} />
            <Th label={t('stats:valuation.col_format')} />
            <Th label={t('stats:valuation.col_condition')} className="text-center" />
            <Th k="purchase" label={t('stats:valuation.col_purchase')} className="text-right" />
            <Th k="market" label={t('stats:valuation.col_market')} className="text-right" />
            <Th k="roi" label={t('stats:valuation.col_roi')} className="text-right" />
          </tr>
        </thead>
        <tbody className="divide-border-default divide-y">
          {rows.map((r, i) => (
            <tr
              key={r.item.id}
              onClick={() => useUi.getState().openDetail(r.item.id)}
              className="text-fg-body hover:bg-brand-softer/40 cursor-pointer transition-[background-color] duration-200"
            >
              <td className="text-fg-body-subtle px-3 py-2 text-center text-xs">{i + 1}</td>
              <td className="truncate px-3 py-2">
                <span className="text-fg-heading block truncate font-medium">{r.item.release.title}</span>
                <span className="text-fg-body-subtle block truncate text-xs">{r.item.release.artist}</span>
              </td>
              <td className="text-fg-body-subtle truncate px-3 py-2 text-xs">{typeLabels[r.item.type]}</td>
              <td className="px-3 py-2 text-center text-xs font-semibold">
                {r.item.mediaCondition ?? '—'}
              </td>
              <td className="truncate px-3 py-2 text-right text-xs tabular-nums">
                {r.purchase != null ? `$${r.purchase.toFixed(2)}` : '—'}
              </td>
              <td className="text-fg-heading truncate px-3 py-2 text-right text-xs font-medium tabular-nums">
                {r.market != null ? `$${r.market.toFixed(2)}` : '—'}
              </td>
              <td className={`truncate px-3 py-2 text-right text-xs font-semibold tabular-nums ${roiTone(r.roi)}`}>
                {r.roi != null
                  ? `${r.roi >= 0 ? '+' : '-'}$${Math.abs(r.roi).toFixed(2)}${
                      r.roiPct != null ? ` (${r.roiPct >= 0 ? '+' : ''}${Math.round(r.roiPct)}%)` : ''
                    }`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValuationModal({
  items,
  missingMarket,
  onRefresh,
  refreshing,
  progress,
}: {
  items: ItemRecord[];
  missingMarket: number;
  onRefresh?: () => void;
  refreshing: boolean;
  progress: { done: number; total: number } | null;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<ValuationSort>('market');
  const rows = useMemo(() => computeValuation(items, sort), [items, sort]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {missingMarket > 0 ? (
          <p className="text-fg-body-subtle text-xs">
            {t('stats:valuation.no_market', { count: missingMarket })}
          </p>
        ) : (
          <span />
        )}
        {onRefresh ? (
          <Button size="sm" variant="neutral" onClick={onRefresh} disabled={refreshing}>
            {refreshing && progress ? `${progress.done}/${progress.total}` : t('stats:refresh.button')}
          </Button>
        ) : null}
      </div>
      <ValuationTable rows={rows} sort={sort} onSort={setSort} />
    </div>
  );
}

interface ModalRowData {
  id: string;
  title: string;
  subtitle?: string;
  right?: string;
  item?: ItemRecord;
}

function ModalRows({ rows }: { rows: ModalRowData[] }) {
  return (
    <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={!r.item}
          onClick={r.item ? () => useUi.getState().openDetail(r.item!.id) : undefined}
          className="hover:shadow-neu-2xs flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-[box-shadow,background-color] duration-200 disabled:cursor-default"
        >
          <span className="min-w-0 flex-1 truncate">
            <span className="text-fg-heading block truncate font-medium">{r.title}</span>
            {r.subtitle ? (
              <span className="text-fg-body-subtle block truncate text-xs">{r.subtitle}</span>
            ) : null}
          </span>
          {r.right ? (
            <span className="text-fg-body-subtle shrink-0 text-xs font-medium">{r.right}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function StatsModal({
  title,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, true, onClose);
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`rounded-base border-border-default bg-surface shadow-neu-xl max-h-[85vh] overflow-y-auto border p-6 ${
          wide ? 'w-full max-w-4xl' : 'w-full max-w-xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-fg-heading text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:button.close')}
            className="text-fg-body-subtle hover:text-fg-heading inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-base transition-neu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function StatsPanelBlock({
  label,
  span = false,
  expandCount,
  onExpand,
  headerAction,
  children,
}: {
  label: string;
  span?: boolean;
  expandCount?: number;
  onExpand?: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section
      className={`rounded-base border-border-default bg-surface shadow-neu-md border p-6 ${
        span ? 'md:col-span-2' : ''
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-fg-heading text-lg font-semibold">{label}</h3>
        <div className="flex items-center gap-2">
          {headerAction}
          {onExpand && expandCount ? (
            <button
              type="button"
              onClick={onExpand}
              className="text-fg-brand hover:text-fg-brand-strong rounded-sm px-2 py-1 text-xs font-medium transition-colors"
            >
              {t('stats:expand.all', { count: expandCount })}
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function RoiRow({ it, roi }: { it: ItemRecord; roi: number }) {
  const positive = roi >= 0;
  return (
    <button
      type="button"
      onClick={() => useUi.getState().openDetail(it.id)}
      className="hover:shadow-neu-2xs flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-[box-shadow,background-color] duration-200"
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="text-fg-heading block truncate font-medium">{it.release.title}</span>
        <span className="text-fg-body-subtle block truncate text-xs">
          {formatMoney(it.purchasePrice ?? 0)} → {formatMoney(it.release.lowestPrice ?? 0)}
        </span>
      </span>
      <span
        className={`shrink-0 font-semibold ${positive ? 'text-fg-success-strong' : 'text-fg-danger-strong'}`}
      >
        {formatMoney(roi, { showSign: true })}
      </span>
    </button>
  );
}

function YearDecadeSection({
  yearEntries,
  decadeEntries,
}: {
  yearEntries: Array<[string, number]>;
  decadeEntries: Array<[string, number]>;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'year' | 'decade'>('year');
  const data = mode === 'year' ? yearEntries : decadeEntries;
  if (!data.length) return null;
  return (
    <section className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-fg-heading text-lg font-semibold">{t('layout:rail.collection.by_year')}</h3>
        <SegmentedControl
          options={[
            { value: 'year', label: t('stats:year_decade.year') },
            { value: 'decade', label: t('stats:year_decade.decade') },
          ]}
          value={mode}
          onChange={(v) => setMode(v as 'year' | 'decade')}
          size="sm"
          ariaLabel={t('layout:rail.collection.by_year')}
        />
      </div>
      <BarChart data={data} maxBars={mode === 'year' ? 15 : 12} ariaLabel={t('stats:chart.bar_aria')} />
    </section>
  );
}

function DnaSection({
  title,
  segments,
}: {
  title: string;
  segments: Array<{ label: string; count: number; pct: number; color: string }>;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-fg-heading mb-2 text-sm font-medium">{title}</div>
      <div className="bg-surface shadow-neu-2xs flex h-3 w-full overflow-hidden rounded-base">
        {segments.map((s) => (
          <div
            key={s.label}
            className="h-full"
            style={{ width: `${Math.max(s.pct * 100, 1.5)}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.count} (${(s.pct * 100).toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-fg-body">{s.label}</span>
            <span className="text-fg-body-subtle">{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Genre cloud — long genre names ("Folk, World, & Country") broke the bar
 * chart's narrow label column. Chips wrap naturally; brand intensity ∝ count.
 */
function GenreCloud({ data, max }: { data: Array<[string, number]>; max: number }) {
  const chartColors = useChartColors();
  const sliced = data.slice(0, max);
  const maxVal = Math.max(...sliced.map(([, v]) => v), 1);
  return (
    <div className="flex flex-wrap gap-1.5" role="img" aria-label="Genres">
      {sliced.map(([label, val]) => {
        const intensity = Math.max(0.15, val / maxVal);
        return (
          <span
            key={label}
            title={`${label}: ${val}`}
            className="rounded-base inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
            style={{ backgroundColor: chartColors.brand(intensity * 0.9) }}
          >
            <span className="text-fg-heading">{label}</span>
            <span className="text-fg-heading/70 tabular-nums">{val}</span>
          </span>
        );
      })}
    </div>
  );
}

function BarChart({ data, maxBars, ariaLabel }: { data: Array<[string, number]>; maxBars: number; ariaLabel: string }) {
  const chartColors = useChartColors();
  const sliced = data.slice(-maxBars);
  const maxVal = Math.max(...sliced.map(([, v]) => v), 1);

  return (
    <div className="flex flex-col gap-2" role="img" aria-label={ariaLabel}>
      {sliced.map(([label, val]) => {
        const pct = (val / maxVal) * 100;
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="text-fg-body-subtle w-10 shrink-0 text-right text-xs font-medium leading-none">
              {label}
            </span>
            <div className="rounded-base bg-surface border-border-default shadow-neu-inset relative h-5 flex-1 overflow-hidden border">
              <div
                className="h-full rounded-base"
                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: chartColors.brand(0.8) }}
              />
            </div>
            <span className="text-fg-heading w-5 shrink-0 text-xs font-semibold leading-none tabular-nums">
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}
