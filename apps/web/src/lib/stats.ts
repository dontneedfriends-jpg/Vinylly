import type { ItemRecord } from '@vinylly/db';

export function computeAcquisitionRange(items: ItemRecord[]): { oldest: string; newest: string | null } | null {
  const dates: string[] = [];
  for (const it of items) if (it.acquiredAt) dates.push(it.acquiredAt);
  if (!dates.length) return null;
  dates.sort();
  const oldest = dates[0]!;
  const newest = dates[dates.length - 1]!;
  const fmt = (iso: string) => iso.slice(0, 10);
  return oldest === newest ? { oldest: fmt(oldest), newest: null } : { oldest: fmt(oldest), newest: fmt(newest) };
}

export interface YearStats {
  avg: number;
  median: number;
}

export function computeYearStats(items: ItemRecord[]): YearStats | null {
  const years: number[] = [];
  for (const it of items) if (it.release.year != null) years.push(it.release.year);
  if (!years.length) return null;
  years.sort((a, b) => a - b);
  const avg = Math.round(years.reduce((s, y) => s + y, 0) / years.length);
  const median = years.length % 2 === 0
    ? Math.round((years[years.length / 2 - 1]! + years[years.length / 2]!) / 2)
    : years[(years.length - 1) / 2]!;
  return { avg, median };
}

export interface HiddenGem {
  it: ItemRecord;
  rating: number;
  want: number;
  score: number;
}

/**
 * Score = rating / log10(want + 10). Higher = more "hidden":
 * great rating, low want count. Filters to rating >= 4.0.
 */
export function computeHiddenGems(items: ItemRecord[], topN = 5): HiddenGem[] {
  const scored = items
    .filter(
      (it) =>
        it.release.communityRatingAvg != null &&
        it.release.communityRatingAvg >= 4.0 &&
        it.release.communityWant != null,
    )
    .map((it) => {
      const r = it.release.communityRatingAvg!;
      const w = Math.max(0, it.release.communityWant ?? 0);
      const score = r / Math.log10(w + 10);
      return { it, rating: r, want: w, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return scored;
}

export interface RgbBreakdown {
  label: string;
  count: number;
  pct: number;
}

/**
 * Bucket items into decades; used for the Collection DNA horizontal bar.
 */
export function computeDecadeBreakdown(items: ItemRecord[]): RgbBreakdown[] {
  if (!items.length) return [];
  const map: Record<string, number> = {};
  for (const it of items) {
    if (!it.release.year) continue;
    const d = `${Math.floor(it.release.year / 10) * 10}s`;
    map[d] = (map[d] ?? 0) + 1;
  }
  const total = items.length;
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([label, count]) => ({ label, count, pct: count / total }));
}

export function computeFormatBreakdown(items: ItemRecord[]): RgbBreakdown[] {
  if (!items.length) return [];
  const total = items.length;
  const types: Array<keyof typeof formatLabels> = ['vinyl', 'cd', 'cassette', 'other'];
  const counts: Record<string, number> = { vinyl: 0, cd: 0, cassette: 0, other: 0 };
  for (const it of items) {
    counts[it.type] = (counts[it.type] ?? 0) + 1;
  }
  return types
    .filter((t) => counts[t]! > 0)
    .map((t) => ({
      label: formatLabels[t],
      count: counts[t]!,
      pct: counts[t]! / total,
    }));
}

const formatLabels = {
  vinyl: 'Vinyl',
  cd: 'CD',
  cassette: 'Cassette',
  other: 'Other',
} as const;

/**
 * Top items by highest `lowest_price`. Used for the "Most valuable" widget.
 */
export function computeMostValuable(items: ItemRecord[], topN = 5): ItemRecord[] {
  return items
    .filter((it) => it.release.lowestPrice != null)
    .slice()
    .sort((a, b) => (b.release.lowestPrice ?? 0) - (a.release.lowestPrice ?? 0))
    .slice(0, topN);
}

/**
 * ROI = lowestPrice - purchasePrice. Top 3 winners and losers.
 */
export interface RoiItem {
  it: ItemRecord;
  roi: number;
}

export function computeRoiLeaders(items: ItemRecord[]): { winners: RoiItem[]; losers: RoiItem[] } {
  const candidates = items
    .filter((it) => it.purchasePrice != null && it.purchasePrice > 0 && it.release.lowestPrice != null)
    .map((it) => ({ it, roi: (it.release.lowestPrice ?? 0) - it.purchasePrice! }))
    .sort((a, b) => b.roi - a.roi);
  const losers = candidates.filter((x) => x.roi < 0).slice(-3).reverse();
  return {
    winners: candidates.slice(0, 3),
    losers,
  };
}

/**
 * Anniversary highlighting — top N releases sorted with milestone years (10/20/25/30/40/50) first.
 */
export interface Anniversary {
  it: ItemRecord;
  years: number;
}

export function computeAnniversaries(items: ItemRecord[], nowYear: number, topN = 5): Anniversary[] {
  const list = items
    .filter((it) => it.release.year != null)
    .map((it) => ({ it, years: nowYear - it.release.year! }))
    .filter((x) => x.years > 0);
  return list
    .sort((a, b) => {
      const aMilestone = a.years % 10 === 0 || a.years % 25 === 0;
      const bMilestone = b.years % 10 === 0 || b.years % 25 === 0;
      if (aMilestone !== bMilestone) return aMilestone ? -1 : 1;
      return b.years - a.years;
    })
    .slice(0, topN);
}
