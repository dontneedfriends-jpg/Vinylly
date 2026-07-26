import type { ItemRecord, MediaType } from '@vinylly/db';

export interface CollectionStats {
  total: number;
  byType: Record<MediaType, number>;
  totalTrackCount: number;
  totalDurationMs: number;
}

export interface FinanceStats {
  totalPurchaseCost: number;
  itemsWithPrice: number;
  avgPurchasePrice: number;
  totalMarketValue: number;
  itemsWithMarket: number;
  avgMarketValue: number;
  estimatedMarketValue: number;
  estimatedProfit: number;
}

/**
 * Headline counts: total + per-format + tracks and playback duration.
 */
export function computeCollectionStats(items: ItemRecord[]): CollectionStats {
  const byType: Record<MediaType, number> = { vinyl: 0, cd: 0, cassette: 0, other: 0 };
  let totalTrackCount = 0;
  let totalDurationMs = 0;
  for (const it of items) {
    byType[it.type] = (byType[it.type] ?? 0) + 1;
    if (it.release.trackCount != null) totalTrackCount += it.release.trackCount;
    if (it.release.totalDurationMs != null) totalDurationMs += it.release.totalDurationMs;
  }
  return {
    total: items.length,
    byType,
    totalTrackCount,
    totalDurationMs,
  };
}

/**
 * Money snapshot — what was paid, what the market says, est. profit.
 * Items missing `lowestPrice` are extrapolated at the average of the priced ones.
 */
export function computeFinanceStats(items: ItemRecord[]): FinanceStats {
  let totalPurchaseCost = 0;
  let itemsWithPrice = 0;
  let totalMarketValue = 0;
  let itemsWithMarket = 0;
  for (const it of items) {
    if (it.purchasePrice != null) {
      totalPurchaseCost += it.purchasePrice;
      itemsWithPrice++;
    }
    if (it.release.lowestPrice != null) {
      totalMarketValue += it.release.lowestPrice;
      itemsWithMarket++;
    }
  }
  const avgFromKnown = itemsWithMarket > 0 ? totalMarketValue / itemsWithMarket : 0;
  const estimatedTotal = totalMarketValue + avgFromKnown * (items.length - itemsWithMarket);
  return {
    totalPurchaseCost,
    itemsWithPrice,
    avgPurchasePrice: itemsWithPrice > 0 ? totalPurchaseCost / itemsWithPrice : 0,
    totalMarketValue,
    itemsWithMarket,
    avgMarketValue: avgFromKnown,
    estimatedMarketValue: estimatedTotal,
    estimatedProfit: estimatedTotal - totalPurchaseCost,
  };
}

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

/**
 * Duplicate detection: items sharing a release id (same pressing twice)
 * or a Discogs master id (different pressings of the same album).
 */
export interface DuplicateGroup {
  key: string;
  kind: 'release' | 'master';
  title: string;
  artist: string;
  items: ItemRecord[];
}

export function computeDuplicates(items: ItemRecord[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();
  for (const it of items) {
    const masterKey = it.release.masterId ? `master:${it.release.masterId}` : null;
    const keys: Array<{ key: string; kind: 'release' | 'master' }> = [
      { key: `release:${it.release.id}`, kind: 'release' },
      ...(masterKey ? [{ key: masterKey, kind: 'master' as const }] : []),
    ];
    for (const { key, kind } of keys) {
      const g = groups.get(key) ?? {
        key,
        kind,
        title: it.release.title,
        artist: it.release.artist,
        items: [],
      };
      if (!g.items.some((x) => x.id === it.id)) g.items.push(it);
      groups.set(key, g);
    }
  }
  // master-groups that are fully covered by a single release-group are noise
  // only when they span 2+ distinct releases do they mean 'pressings'.
  return [...groups.values()]
    .filter((g) => g.items.length > 1)
    .filter((g) => g.kind === 'release' || new Set(g.items.map((i) => i.release.id)).size > 1)
    .sort((a, b) => b.items.length - a.items.length);
}


/**
 * Full collection valuation: one row per item with purchase vs market price
 * and ROI. Items without market data sort last.
 */
export interface ValuationRow {
  item: ItemRecord;
  purchase: number | null;
  market: number | null;
  roi: number | null;
  roiPct: number | null;
}

export type ValuationSort = 'market' | 'purchase' | 'roi' | 'title' | 'year';

export function computeValuation(items: ItemRecord[], sort: ValuationSort = 'market'): ValuationRow[] {
  const rows: ValuationRow[] = items.map((item) => {
    const purchase = item.purchasePrice;
    const market = item.release.lowestPrice;
    const roi = purchase != null && market != null ? market - purchase : null;
    const roiPct = roi != null && purchase! > 0 ? (roi / purchase!) * 100 : null;
    return { item, purchase, market, roi, roiPct };
  });
  const num = (v: number | null, fallback: number) => (v == null ? fallback : v);
  rows.sort((a, b) => {
    switch (sort) {
      case 'purchase':
        return num(b.purchase, -1) - num(a.purchase, -1);
      case 'roi':
        return num(b.roi, -Infinity) - num(a.roi, -Infinity);
      case 'title':
        return a.item.release.title.localeCompare(b.item.release.title, 'ru');
      case 'year':
        return (b.item.release.year ?? 0) - (a.item.release.year ?? 0);
      default:
        return num(b.market, -1) - num(a.market, -1);
    }
  });
  return rows;
}

