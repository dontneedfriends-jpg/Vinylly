import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, SegmentedControl } from '@vinylly/ui';
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
} from '../lib/stats';
import { formatMoney } from '../lib/format';
import { useTypeLabels } from '../lib/type-labels';
import { useChartColors } from '../lib/chart-colors';

export function StatsPanel() {
  const { t, i18n } = useTranslation();
  const { data: items = [] } = useItems({});
  const chartColors = useChartColors();

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

          {yearEntries.length > 0 || decadeEntries.length > 0 ? (
            <YearDecadeSection yearEntries={yearEntries} decadeEntries={decadeEntries} />
          ) : null}

          {genreEntries.length > 0 ? (
            <StatsPanelBlock label={t('layout:rail.collection.by_genre')}>
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
            <StatsPanelBlock label={t('stats:tags.title')}>
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
            </StatsPanelBlock>
          ) : null}

          {topValue.length > 0 ? (
            <StatsPanelBlock label={t('stats:top_value.title')}>
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
            <StatsPanelBlock label={t('stats:hidden_gems.title')}>
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
            <StatsPanelBlock label={t('stats:duplicates.title')}>
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
            <StatsPanelBlock label={t('stats:anniversaries.title')}>
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
            <StatsPanelBlock label={t('stats:artist_spend.title')}>
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
    </div>
  );
}

function StatsPanelBlock({
  label,
  span = false,
  children,
}: {
  label: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-base border-border-default bg-surface shadow-neu-md border p-6 ${
        span ? 'md:col-span-2' : ''
      }`}
    >
      <h3 className="text-fg-heading mb-4 text-lg font-semibold">{label}</h3>
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
