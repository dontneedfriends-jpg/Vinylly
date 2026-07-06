import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useItems } from '../lib/queries';
import type { MediaType, ItemRecord } from '@vinylly/db';
import { ArtistPackChart } from './ArtistPackChart';
import { CoverImage } from './CoverImage';
import { useUi } from '../lib/ui-store';
import {
  computeAcquisitionRange,
  computeAnniversaries,
  computeDecadeBreakdown,
  computeFormatBreakdown,
  computeHiddenGems,
  computeMostValuable,
  computeRoiLeaders,
  computeYearStats,
} from '../lib/stats';

export function StatsPanel() {
  const { t } = useTranslation();
  const { data: items = [] } = useItems({});

  const typeLabels: Record<string, string> = {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };

  const stats = useMemo(() => {
    const total = items.length;
    const byType: Record<string, number> = {};
    let totalPurchaseCost = 0;
    let itemsWithPrice = 0;
    let totalMarketValue = 0;
    let itemsWithMarket = 0;
    let totalDurationMs = 0;
    let totalTrackCount = 0;
    for (const it of items) {
      byType[it.type] = (byType[it.type] ?? 0) + 1;
      if (it.purchasePrice != null) {
        totalPurchaseCost += it.purchasePrice;
        itemsWithPrice++;
      }
      if (it.release.lowestPrice != null) {
        totalMarketValue += it.release.lowestPrice;
        itemsWithMarket++;
      }
      if (it.release.totalDurationMs != null) totalDurationMs += it.release.totalDurationMs;
      if (it.release.trackCount != null) totalTrackCount += it.release.trackCount;
    }
    const avgFromKnown = itemsWithMarket > 0 ? totalMarketValue / itemsWithMarket : 0;
    const estimatedTotal = totalMarketValue + avgFromKnown * (total - itemsWithMarket);
    return {
      total,
      byType,
      totalPurchaseCost,
      avgPurchasePrice: itemsWithPrice > 0 ? totalPurchaseCost / itemsWithPrice : 0,
      itemsWithPrice,
      totalMarketValue,
      avgMarketValue: avgFromKnown,
      itemsWithMarket,
      estimatedMarketValue: estimatedTotal,
      estimatedProfit: estimatedTotal - totalPurchaseCost,
      totalDurationMs,
      totalTrackCount,
    };
  }, [items]);

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

  const acquisition = useMemo(() => computeAcquisitionRange(items), [items]);

  const yearStats = useMemo(() => computeYearStats(items), [items]);

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) for (const tag of it.tags) counts[tag] = (counts[tag] ?? 0) + 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [items]);

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

  const dna = useMemo(() => {
    if (!items.length) return null;
    return {
      decades: computeDecadeBreakdown(items),
      formats: computeFormatBreakdown(items),
      total: items.length,
    };
  }, [items]);

  const anniversaries = useMemo(() => computeAnniversaries(items, new Date().getFullYear()), [items]);

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
      .slice(0, 5)
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
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      months.push({ key, count: counts[key] ?? 0, label });
    }
    const max = Math.max(...months.map((m) => m.count), 1);
    return { months, max };
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      {/* Counts */}
      <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-5 py-4">
        <div className="text-fg-heading text-2xl font-semibold">{stats.total}</div>
        <div className="text-fg-body-subtle text-xs">{t('layout:rail.collection.total_releases')}</div>
        <div className="mt-3 flex flex-col gap-1">
          {(Object.keys(stats.byType) as MediaType[]).map((k) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-fg-body">{typeLabels[k] ?? k}</span>
              <span className="text-fg-heading font-medium">{stats.byType[k]}</span>
            </div>
          ))}
        </div>
        {stats.totalTrackCount > 0 ? (
          <div className="text-fg-body-subtle mt-3 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span>{t('stats:finances.tracks')}</span>
              <span className="text-fg-heading font-medium">{stats.totalTrackCount}</span>
            </div>
            {stats.totalDurationMs > 0 ? (
              <div className="flex items-center justify-between">
                <span>{t('stats:finances.total_duration')}</span>
                <span className="text-fg-heading font-medium">{formatDuration(stats.totalDurationMs)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {acquisition ? (
          <div className="text-fg-body-subtle mt-3 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span>{t('stats:acquisition.first')}</span>
              <span className="text-fg-heading font-medium">{acquisition.oldest}</span>
            </div>
            {acquisition.newest ? (
              <div className="flex items-center justify-between">
                <span>{t('stats:acquisition.latest')}</span>
                <span className="text-fg-heading font-medium">{acquisition.newest}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {yearStats ? (
          <div className="text-fg-body-subtle mt-3 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span>{t('stats:years.avg')}</span>
              <span className="text-fg-heading font-medium">{yearStats.avg}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('stats:years.median')}</span>
              <span className="text-fg-heading font-medium">{yearStats.median}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Finances */}
      <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-5 py-4">
        <div className="text-fg-heading mb-3 text-sm font-semibold">{t('stats:finances.title')}</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-body-subtle">{t('stats:finances.total_paid')}</span>
            <span className="text-fg-heading font-medium">{formatMoney(stats.totalPurchaseCost)}</span>
          </div>
          {stats.itemsWithPrice > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-body-subtle">{t('stats:finances.avg_price')}</span>
              <span className="text-fg-body">{formatMoney(stats.avgPurchasePrice)}</span>
            </div>
          ) : null}
          {stats.itemsWithMarket > 0 ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg-body-subtle">{t('stats:finances.market_value')}</span>
                <span className="text-fg-heading font-medium">{formatMoney(stats.estimatedMarketValue)}</span>
              </div>
              {stats.itemsWithMarket < stats.total ? (
                <div className="text-fg-body-subtle text-[10px]">
                  {t('stats:finances.market_value_desc', {
                    known: stats.itemsWithMarket,
                    total: stats.total,
                    avg: formatMoney(stats.avgMarketValue),
                  })}
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg-body-subtle">{t('stats:finances.estimated_profit')}</span>
                <span className={`font-medium ${stats.estimatedProfit >= 0 ? 'text-fg-success-strong' : 'text-fg-danger-strong'}`}>
                  {formatMoney(stats.estimatedProfit, { showSign: true })}
                </span>
              </div>
            </>
          ) : null}
          <div className="text-fg-body-subtle mt-1 text-[10px]">
            {stats.itemsWithPrice > 0
              ? t('stats:finances.priced_count', { count: stats.itemsWithPrice, total: stats.total })
              : t('stats:finances.no_prices')}
          </div>
        </div>
      </div>

      {/* Charts */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h3 className="text-fg-heading text-lg font-semibold">{t('layout:rail.collection.charts')}</h3>

          {/* Pack chart — artists / genre */}
          <ArtistPackChart />

          {yearEntries.length > 0 || decadeEntries.length > 0 ? (
            <YearDecadeSection yearEntries={yearEntries} decadeEntries={decadeEntries} />
          ) : null}

          {genreEntries.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('layout:rail.collection.by_genre')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-4 py-3">
                <BarChart data={genreEntries} maxBars={12} />
              </div>
            </div>
          ) : null}

          {topTags.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:tags.title')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-4 py-3">
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
              </div>
            </div>
          ) : null}

          {topValue.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:top_value.title')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {topValue.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => useUi.getState().openDetail(it.id)}
                    className="hover:bg-surface flex w-full items-center gap-3 px-4 py-2 text-left transition-colors"
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
            </div>
          ) : null}

          {activity ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:activity.title')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-4 py-3">
                <div className="grid grid-cols-12 gap-1.5">
                  {activity.months.map((m) => {
                    const intensity = m.count === 0 ? 0 : Math.max(0.2, m.count / activity.max);
                    const bg =
                      m.count === 0
                        ? 'bg-surface shadow-neu-2xs'
                        : `bg-fg-brand/20`;
                    return (
                      <div
                        key={m.key}
                        className="flex flex-col items-center gap-1"
                        title={`${m.label} ${m.key}: ${m.count}`}
                      >
                        <div
                          className={`rounded-base h-7 w-full ${bg}`}
                          style={m.count > 0 ? { backgroundColor: `rgba(15, 98, 254, ${intensity})` } : undefined}
                        />
                        <span className="text-fg-body-subtle text-[10px]">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {missing.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:missing.title')}
              </h4>
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
            </div>
          ) : null}

          {topWinners.length > 0 || topLosers.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:roi.title')}
              </h4>
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
            </div>
          ) : null}

          {hiddenGems.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:hidden_gems.title')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {hiddenGems.map(({ it, rating, want }) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => useUi.getState().openDetail(it.id)}
                    className="hover:bg-surface flex w-full items-center gap-3 px-4 py-2 text-left text-sm"
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
            </div>
          ) : null}

          {anniversaries.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:anniversaries.title')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {anniversaries.map(({ it, years }) => {
                  const milestone = years % 10 === 0 || years % 25 === 0;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => useUi.getState().openDetail(it.id)}
                      className="hover:bg-surface flex w-full items-center gap-3 px-4 py-2 text-left text-sm"
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
                      <span className="text-fg-body-subtle shrink-0 text-[10px]">→</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {dna ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:dna.title')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border p-4">
                <DnaSection
                  title={t('stats:dna.decades')}
                  segments={dna.decades.map((d) => ({ label: d.label, count: d.count, pct: d.pct }))}
                  palette="decade"
                />
                <DnaSection
                  title={t('stats:dna.formats')}
                  segments={dna.formats.map((f) => ({
                    label: typeLabels[f.label as MediaType] ?? f.label,
                    count: f.count,
                    pct: f.pct,
                  }))}
                  palette="format"
                />
              </div>
            </div>
          ) : null}

          {topArtistSpend.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('stats:artist_spend.title')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border divide-border-default divide-y overflow-hidden">
                {topArtistSpend.map(({ artist, total, count }) => (
                  <div key={artist} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-fg-heading min-w-0 truncate">{artist}</span>
                    <span className="text-fg-body-subtle ml-2 shrink-0 text-xs">
                      {formatMoney(total)}
                      <span className="text-fg-body-subtle ml-1.5">· {count}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RoiRow({ it, roi }: { it: ItemRecord; roi: number }) {
  const positive = roi >= 0;
  return (
    <button
      type="button"
      onClick={() => useUi.getState().openDetail(it.id)}
      className="hover:bg-surface flex w-full items-center gap-3 px-4 py-2 text-left text-sm"
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
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-fg-body-subtle text-xs font-medium uppercase tracking-wide">
          {t('layout:rail.collection.by_year')}
        </h4>
        <div className="rounded-base bg-surface shadow-neu-inset flex items-center gap-0.5 p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setMode('year')}
            className={`rounded-base px-2 py-0.5 transition-colors ${
              mode === 'year' ? 'bg-surface text-fg-heading shadow-neu-2xs' : 'text-fg-body-subtle'
            }`}
          >
            {t('stats:year_decade.year')}
          </button>
          <button
            type="button"
            onClick={() => setMode('decade')}
            className={`rounded-base px-2 py-0.5 transition-colors ${
              mode === 'decade' ? 'bg-surface text-fg-heading shadow-neu-2xs' : 'text-fg-body-subtle'
            }`}
          >
            {t('stats:year_decade.decade')}
          </button>
        </div>
      </div>
      <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-4 py-3">
        <BarChart data={data} maxBars={mode === 'year' ? 15 : 12} />
      </div>
    </div>
  );
}

function DnaSection({
  title,
  segments,
  palette,
}: {
  title: string;
  segments: Array<{ label: string; count: number; pct: number }>;
  palette: 'decade' | 'format';
}) {
  const decadeColors = ['#0f62fe', '#4589ff', '#0072c3', '#5b6677', '#8d8d8d', '#5e7c8b', '#9b82f3', '#b990ff'];
  const formatColors: Record<string, string> = {
    vinyl: '#0f62fe',
    cd: '#4589ff',
    cassette: '#b990ff',
    other: '#8d8d8d',
  };
  const colorFor = (idx: number, label: string) =>
    palette === 'format' ? formatColors[label] ?? '#8d8d8d' : decadeColors[idx % decadeColors.length]!;
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-fg-body-subtle mb-2 text-[11px] uppercase tracking-wide">{title}</div>
      <div className="bg-surface shadow-neu-2xs flex h-3 w-full overflow-hidden rounded-base">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="h-full"
            style={{ width: `${Math.max(s.pct * 100, 1.5)}%`, backgroundColor: colorFor(i, s.label) }}
            title={`${s.label}: ${s.count} (${(s.pct * 100).toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: colorFor(i, s.label) }}
            />
            <span className="text-fg-body">{s.label}</span>
            <span className="text-fg-body-subtle">{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMoney(amount: number, { showSign = false }: { showSign?: boolean } = {}): string {
  const sign = showSign ? (amount >= 0 ? '+' : '-') : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

function BarChart({ data, maxBars }: { data: Array<[string, number]>; maxBars: number }) {
  const sliced = data.slice(-maxBars);
  const maxVal = Math.max(...sliced.map(([, v]) => v), 1);

  return (
    <div className="flex flex-col gap-2" role="img" aria-label="Bar chart">
      {sliced.map(([label, val]) => {
        const pct = (val / maxVal) * 100;
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="text-fg-body-subtle w-10 shrink-0 text-right text-[10px] font-medium leading-none">
              {label}
            </span>
            <div className="rounded-base bg-surface border-border-default shadow-neu-2xs relative h-5 flex-1 overflow-hidden border">
              <div
                className="bg-surface border-border-default-medium shadow-neu-xs h-full rounded-DEFAULT border"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <span className="text-fg-heading w-5 shrink-0 text-[10px] font-semibold leading-none">
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}
