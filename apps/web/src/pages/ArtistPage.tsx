import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, PageHeader } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItems, useWantlist } from '../lib/queries';
import type { ItemRecord, WantlistEntry } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';
import { getProvidersRegistry } from '../lib/providers';

interface ArtistInfo {
  id: number;
  name: string;
  imageUrl: string | null;
  profile: string | null;
}

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
        // Kick off catalog-size fetch (non-blocking)
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
    <section className="animate-rise">
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

      {infoLoading ? (
        <div className="rounded-base border-border-default bg-surface shadow-neu-md mb-6 flex items-center gap-5 border p-6">
          <div className="rounded-base shadow-neu-2xs bg-surface h-20 w-20 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="bg-surface shadow-neu-2xs h-4 w-2/3 animate-pulse rounded" />
            <div className="bg-surface shadow-neu-2xs h-3 w-1/2 animate-pulse rounded" />
          </div>
        </div>
      ) : info ? (
        <div className="rounded-base border-border-default bg-surface shadow-neu-md mb-6 flex items-start gap-5 border p-6">
          {info.imageUrl ? (
            <img
              src={info.imageUrl}
              alt={info.name}
              className="rounded-base shadow-neu-inset h-20 w-20 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="rounded-base bg-surface shadow-neu-inset text-fg-body-subtle flex h-20 w-20 items-center justify-center text-2xl">
              {info.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-fg-body-subtle text-xs">{t('artist:page.on_discogs')}</div>
            {info.profile ? (
              <p className="text-fg-body mt-2 line-clamp-3 text-sm leading-relaxed">{info.profile}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Owned */}
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-fg-heading text-lg font-semibold">
              {t('artist:section.owned')}
            </h2>
            <CompletionBadge owned={owned.length} total={catalogTotal} />
          </div>
          {owned.length === 0 ? (
            <p className="text-fg-body-subtle text-sm">{t('artist:empty.owned')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {owned.slice(0, 12).map((it) => (
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
          {owned.length > 12 ? (
            <div className="text-fg-body-subtle mt-3 text-xs">
              {t('artist:more', { count: owned.length - 12 })}
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

function CompletionBadge({ owned, total }: { owned: number; total: number | null }) {
  if (total == null || total <= 0) {
    return <span className="text-fg-body-subtle text-xs">{owned}</span>;
  }
  const pct = Math.min(100, Math.round((owned / total) * 100));
  const tier =
    pct >= 75 ? 'text-fg-success-strong'
    : pct >= 40 ? 'text-fg-brand'
    : pct >= 15 ? 'text-fg-warning'
    : 'text-fg-body-subtle';
  return (
    <span className={`text-xs font-medium ${tier}`}>
      {owned} / {total}
      <span className="text-fg-body-subtle ml-1 font-normal">({pct}%)</span>
    </span>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M19 12H5m6-6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}