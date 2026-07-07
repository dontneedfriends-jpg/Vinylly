import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, PageHeader } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItems, useWantlist } from '../lib/queries';
import type { ItemRecord, MediaType, WantlistEntry } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';
import { getProvidersRegistry } from '../lib/providers';
import { stripMarkup } from '../lib/text';

interface ArtistInfo {
  id: number;
  name: string;
  imageUrl: string | null;
  profile: string | null;
}

type FormatFilter = 'all' | MediaType;

export function ArtistPage() {
  const { t } = useTranslation();
  const artistName = useUi((s) => s.artistName);
  const openCollection = useUi((s) => s.openCollection);
  const openDetail = useUi((s) => s.openDetail);
  const openReleasePreview = useUi((s) => s.openReleasePreview);
  const openWantlist = useUi((s) => s.openWantlist);
  const { data: items = [] } = useItems({});
  const { data: wantlist = [] } = useWantlist();

  const [info, setInfo] = useState<ArtistInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');

  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;
    setInfo(null);
    setCatalogTotal(null);
    setInfoLoading(true);
    void (async () => {
      const registry = getProvidersRegistry();
      if (!registry.discogs?.isEnabled()) {
        setInfoLoading(false);
        return;
      }
      try {
        const id = await registry.findArtistId(artistName);
        if (!id || cancelled) {
          setInfoLoading(false);
          return;
        }
        const a = await registry.discogs.getArtist(id);
        if (cancelled || !a) return;
        const img = a.images?.find((i) => i.type === 'primary') ?? a.images?.[0];
        setInfo({
          id: a.id,
          name: a.name,
          imageUrl: img?.uri ?? null,
          profile: a.profile ?? null,
        });
        const count = await registry.getArtistReleaseCount(id);
        if (!cancelled && count) setCatalogTotal(count.total);
      } catch (err) {
        console.warn('[artist] fetch failed:', err);
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artistName]);

  const { owned, wanted, ownedByYear } = useMemo(() => {
    if (!artistName) return { owned: [] as ItemRecord[], wanted: [] as WantlistEntry[], ownedByYear: [] as Array<[string, number]> };
    const lc = artistName.toLowerCase();
    const owned = items.filter((it) => it.release.artist.toLowerCase() === lc);
    const wanted = wantlist.filter((w) => w.release.artist.toLowerCase() === lc);
    const yearMap: Record<string, number> = {};
    for (const it of owned) {
      const y = it.release.year ? String(it.release.year) : '?';
      yearMap[y] = (yearMap[y] ?? 0) + 1;
    }
    const ownedByYear = Object.entries(yearMap).sort(([a], [b]) => Number(a) - Number(b));
    return { owned, wanted, ownedByYear };
  }, [items, wantlist, artistName]);

  const filteredOwned = useMemo(() => {
    if (formatFilter === 'all') return owned;
    return owned.filter((it) => it.type === formatFilter);
  }, [owned, formatFilter]);

  const formatOptions: Array<{ value: FormatFilter; label: string }> = [
    { value: 'all', label: t('artist:format.all') },
    { value: 'vinyl', label: t('common:media.vinyl') },
    { value: 'cd', label: t('common:media.cd') },
    { value: 'cassette', label: t('common:media.cassette') },
    { value: 'other', label: t('common:media.other') },
  ];

  if (!artistName) {
    return (
      <section className="animate-rise">
        <PageHeader level="h1" title={t('artist:page.no_artist')} />
        <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />} size="sm">
          {t('common:button.back')}
        </Button>
      </section>
    );
  }

  return (
    <section
      key={artistName ?? 'empty'}
      className="animate-rise"
    >
      <PageHeader
        level="h1"
        title={info?.name ?? artistName}
        subtitle={t('artist:page.subtitle', { owned: owned.length, wanted: wanted.length })}
        actions={
          <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />} size="sm">
            {t('common:button.back')}
          </Button>
        }
      />

      {/* Collapsible About card */}
      {(infoLoading || info) && (
        <div className="rounded-base border-border-default bg-surface shadow-neu-md mb-6 border">
          <button
            type="button"
            onClick={() => setAboutOpen((v) => !v)}
            aria-expanded={aboutOpen}
            className="hover:text-fg-heading text-fg-body flex w-full items-center gap-5 px-6 py-5 text-left transition-colors"
          >
            {infoLoading ? (
              <>
                <div className="rounded-base shadow-neu-2xs bg-surface h-14 w-14 shrink-0 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="bg-surface shadow-neu-2xs h-4 w-2/3 animate-pulse rounded" />
                  <div className="bg-surface shadow-neu-2xs h-3 w-1/2 animate-pulse rounded" />
                </div>
              </>
            ) : info ? (
              <>
                {info.imageUrl ? (
                  <img
                    src={info.imageUrl}
                    alt={info.name}
                    className="rounded-base shadow-neu-inset h-14 w-14 shrink-0 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="rounded-base bg-surface shadow-neu-inset text-fg-body-subtle flex h-14 w-14 shrink-0 items-center justify-center text-xl">
                    {info.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-fg-body-subtle text-xs">{t('artist:page.on_discogs')}</div>
                  {info.profile ? (
                    <p
                      className={`text-fg-body mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                        aboutOpen ? '' : 'line-clamp-1'
                      }`}
                    >
                      {stripMarkup(info.profile)}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`text-fg-body-subtle text-sm transition-transform duration-200 ${
                    aboutOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                >
                  ▾
                </span>
              </>
            ) : null}
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Owned */}
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-fg-heading text-lg font-semibold">{t('artist:section.owned')}</h2>
            <CompletionBadge
              owned={filteredOwned.length}
              total={catalogTotal}
              filter={formatFilter}
              estimateLabel={t('artist:completion.estimate')}
              ownedByType={formatOptions.slice(1).map((opt) => ({
                value: opt.value as MediaType,
                label: opt.label,
                count: owned.filter((it) => it.type === opt.value).length,
              }))}
            />
          </div>

          {/* Format filter chips */}
          {owned.length > 0 ? (
            <div className="rounded-base bg-surface shadow-neu-inset mb-4 flex flex-wrap gap-1 p-1">
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormatFilter(opt.value)}
                  className={`rounded-base px-3 py-1 text-xs transition-all ${
                    formatFilter === opt.value
                      ? 'bg-surface text-fg-heading shadow-neu-2xs font-medium'
                      : 'text-fg-body-subtle hover:text-fg-body'
                  }`}
                >
                  {opt.label}
                  {opt.value !== 'all' && (
                    <span className="text-fg-body-subtle ml-1">
                      ({owned.filter((it) => it.type === opt.value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : null}

          {filteredOwned.length === 0 ? (
            <p className="text-fg-body-subtle text-sm">
              {formatFilter === 'all'
                ? t('artist:empty.owned')
                : t('artist:empty.owned_filtered', { format: formatOptions.find((o) => o.value === formatFilter)?.label })}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filteredOwned.slice(0, 12).map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => openDetail(it.id)}
                  className="rounded-base shadow-neu-2xs hover:shadow-neu-inset bg-surface aspect-square overflow-hidden transition-shadow"
                  title={`${it.release.title} (${it.release.year ?? '—'})`}
                >
                  <CoverImage
                    releaseId={it.release.id}
                    coverPath={it.release.thumbPath ?? it.release.coverPath}
                    coverRemote={it.release.thumbRemote ?? it.release.coverRemote}
                    alt={it.release.title}
                    size="thumb"
                  />
                </button>
              ))}
            </div>
          )}
          {filteredOwned.length > 12 ? (
            <div className="text-fg-body-subtle mt-3 text-xs">
              {t('artist:more', { count: filteredOwned.length - 12 })}
            </div>
          ) : null}
          {ownedByYear.length > 0 ? (
            <div className="mt-4 space-y-1">
              {ownedByYear.slice(-5).map(([y, c]) => (
                <div key={y} className="text-fg-body-subtle flex justify-between text-xs">
                  <span>{y}</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Wanted */}
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-fg-heading text-lg font-semibold">{t('artist:section.wanted')}</h2>
            <span className="text-fg-body-subtle text-xs">{wanted.length}</span>
          </div>
          {wanted.length === 0 ? (
            <p className="text-fg-body-subtle text-sm">{t('artist:empty.wanted')}</p>
          ) : (
            <ul className="divide-border-default divide-y">
              {wanted.slice(0, 8).map((w) => (
                <li key={w.id} className="py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => openReleasePreview(w.release.id)}
                    className="hover:text-fg-heading text-fg-body text-left"
                  >
                    <span className="block truncate font-medium">{w.release.title}</span>
                    <span className="text-fg-body-subtle block truncate text-xs">
                      {w.release.year ?? '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {wanted.length > 0 ? (
            <Button size="sm" variant="neutral" className="mt-3" onClick={openWantlist}>
              {t('artist:section.open_wantlist')}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CompletionBadge({
  owned,
  total,
  filter,
  estimateLabel,
  ownedByType,
}: {
  owned: number;
  total: number | null;
  filter: FormatFilter;
  estimateLabel: string;
  ownedByType: Array<{ value: MediaType; label: string; count: number }>;
}) {
  if (total == null || total <= 0) {
    return <span className="text-fg-body-subtle text-xs">{owned}</span>;
  }
  const pct = Math.min(100, Math.round((owned / total) * 100));
  const tier =
    pct >= 75 ? 'text-fg-success-strong'
    : pct >= 40 ? 'text-fg-brand'
    : pct >= 15 ? 'text-fg-warning'
    : 'text-fg-body-subtle';
  // When a single format is selected, estimate that format's share of the catalog.
  // Discogs doesn't break down by format, so we apply a heuristic: assume the
  // format distribution in the catalog matches the local collection. This is
  // intentionally rough — the All view is the source of truth.
  let displayTotal = total;
  if (filter !== 'all') {
    const typeOwned = ownedByType.reduce((s, t) => s + t.count, 0);
    if (typeOwned > 0) {
      const ratio = ownedByType.find((t) => t.value === filter)!.count / typeOwned;
      displayTotal = Math.max(1, Math.round(total * ratio));
    }
  }
  const finalPct = Math.min(100, Math.round((owned / displayTotal) * 100));
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`text-xs font-medium ${tier}`}>
        {owned} / {displayTotal}
        <span className="text-fg-body-subtle ml-1 font-normal">({finalPct}%)</span>
      </span>
      {filter !== 'all' ? (
        <span className="text-fg-body-subtle text-[10px]">{estimateLabel}</span>
      ) : null}
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M19 12H5m6-6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
