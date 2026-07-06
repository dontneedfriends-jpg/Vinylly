import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useItems } from '../lib/queries';
import { getProvidersRegistry } from '../lib/providers';

type PackMode = 'artist' | 'genre';

const SEP_RE = /\s*(?:[&＆]|feat\.|featuring|ft\.?|with|[,／/])\s*/i;

const GROUP_COLORS = [
  '#0F62FE',
  '#FA4D56',
  '#24A148',
  '#FF832B',
  '#8A3FFC',
  '#009D9A',
  '#EE5396',
  '#D12765',
  '#1192E8',
  '#A56EFF',
];

function parse(raw: string): string[] {
  const t = raw.trim();
  if (!t || t === '?') return [];
  return t.split(SEP_RE).map((s) => s.trim()).filter(Boolean);
}

export function ArtistPackChart() {
  const { t } = useTranslation();
  const { data: items = [] } = useItems({});
  const [mode, setMode] = useState<PackMode>('artist');
  const [limit, setLimit] = useState(25);
  const [lfmEdges, setLfmEdges] = useState<Map<string, Set<string>>>(new Map());
  const fetching = useRef(false);

  // build co-occurrence from multi-artist fields
  const localEdges = useMemo(() => {
    const edges = new Map<string, Set<string>>();
    for (const it of items) {
      const artists = parse(it.release.artist);
      for (let i = 0; i < artists.length; i++) {
        for (let j = i + 1; j < artists.length; j++) {
          const a = artists[i]!;
          const b = artists[j]!;
          if (!edges.has(a)) edges.set(a, new Set());
          if (!edges.has(b)) edges.set(b, new Set());
          edges.get(a)!.add(b);
          edges.get(b)!.add(a);
        }
      }
    }
    return edges;
  }, [items]);

  // fetch Last.fm similar artists for top artists
  useEffect(() => {
    if (mode !== 'artist' || fetching.current) return;
    fetching.current = true;

    const registry = getProvidersRegistry();
    if (!registry.lastfm?.isEnabled()) { fetching.current = false; return; }

    // count artists to pick top candidates
    const counts = new Map<string, number>();
    for (const it of items) {
      for (const a of parse(it.release.artist)) {
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }
    const topArtists = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.min(limit, 25))
      .map(([name]) => name);

    let cancelled = false;
    const newEdges = new Map<string, Set<string>>();

    (async () => {
      for (const name of topArtists) {
        if (cancelled) break;
        const related = await registry.getRelatedArtists(name);
        if (cancelled) break;
        for (const r of related) {
          if (!newEdges.has(name)) newEdges.set(name, new Set());
          if (!newEdges.has(r)) newEdges.set(r, new Set());
          newEdges.get(name)!.add(r);
          newEdges.get(r)!.add(name);
        }
        // progressive update
        setLfmEdges(new Map(newEdges));
      }
      fetching.current = false;
    })();

    return () => { cancelled = true; };
  }, [items, mode, limit]);

  // merge local + lfm edges and compute groups
  const { entries, groupMap } = useMemo(() => {
    if (mode === 'genre') {
      const counts = new Map<string, number>();
      for (const it of items) {
        for (const g of it.release.genres) {
          counts.set(g, (counts.get(g) ?? 0) + 1);
        }
      }
      const entries = [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      return { entries, groupMap: new Map<string, number>() };
    }

    // count artists
    const counts = new Map<string, number>();
    for (const it of items) {
      for (const a of parse(it.release.artist)) {
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }

    // union-find on merged edges
    const merged = new Map<string, Set<string>>();
    const addEdge = (a: string, b: string) => {
      if (!merged.has(a)) merged.set(a, new Set());
      if (!merged.has(b)) merged.set(b, new Set());
      merged.get(a)!.add(b);
      merged.get(b)!.add(a);
    };
    for (const [a, ns] of localEdges) for (const b of ns) addEdge(a, b);
    for (const [a, ns] of lfmEdges) for (const b of ns) addEdge(a, b);

    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x);
      if (p === undefined) { parent.set(x, x); return x; }
      if (p !== x) { parent.set(x, find(p)); }
      return parent.get(x) ?? x;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    for (const [a, ns] of merged) for (const b of ns) union(a, b);

    const groupIdx = new Map<string, number>();
    let gid = 0;
    const entries = [...counts.entries()]
      .map(([label, count]) => {
        const root = find(label);
        if (!groupIdx.has(root)) groupIdx.set(root, gid++);
        return { label, count, group: groupIdx.get(root)! };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const groupMap = new Map<string, number>();
    for (const e of entries) groupMap.set(e.label, e.group);

    return { entries, groupMap };
  }, [items, mode, limit, localEdges, lfmEdges]);

  const maxCount = entries[0]?.count ?? 1;

  if (entries.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-base border-border-default bg-surface shadow-neu-inset border p-0.5">
          <button
            type="button"
            onClick={() => setMode('artist')}
            className={`rounded-sm px-2.5 py-0.5 text-xs font-medium transition-all ${
              mode === 'artist'
                ? 'bg-surface text-fg-brand-strong shadow-neu-xs'
                : 'text-fg-body-subtle hover:text-fg-body'
            }`}
          >
            {t('layout:rail.collection.by_artist')}
          </button>
          <button
            type="button"
            onClick={() => setMode('genre')}
            className={`rounded-sm px-2.5 py-0.5 text-xs font-medium transition-all ${
              mode === 'genre'
                ? 'bg-surface text-fg-brand-strong shadow-neu-xs'
                : 'text-fg-body-subtle hover:text-fg-body'
            }`}
          >
            {t('layout:rail.collection.by_genre')}
          </button>
        </div>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-base border-border-default bg-surface text-fg-body-subtle px-2 py-0.5 text-xs"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div className="rounded-base border-border-default bg-surface shadow-neu-inset border p-3">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {entries.map((entry) => {
            const ratio = entry.count / maxCount;
            const size = 48 + ratio * 72;
            const fontSize = 9 + ratio * 4;
            const color = mode === 'artist'
              ? GROUP_COLORS[(groupMap.get(entry.label) ?? 0) % GROUP_COLORS.length]
              : undefined;

            return (
              <div
                key={entry.label}
                className="rounded-full bg-surface shadow-neu-sm hover:shadow-neu-md relative inline-flex flex-col items-center justify-center border text-center transition-all duration-200"
                style={{
                  width: size,
                  height: size,
                  borderColor: color ?? undefined,
                }}
                title={`${entry.label} — ${entry.count}`}
              >
                <span
                  className="text-fg-heading leading-tight font-medium"
                  style={{ fontSize: `${fontSize}px`, maxWidth: '80%' }}
                >
                  {entry.label.length > 12 ? `${entry.label.slice(0, 10)}…` : entry.label}
                </span>
                <span
                  className="text-fg-body-subtle leading-none"
                  style={{ fontSize: `${Math.max(fontSize - 2, 7)}px` }}
                >
                  {entry.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
