import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Input } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItem, useItems, useTracks } from '../lib/queries';
import { getProvidersRegistry } from '../lib/providers';
import { useSettings } from '../lib/settings-store';
import { getAppInfo, type AppInfo } from '../lib/app-info';
import type { MediaType } from '@vinylly/db';
import { ExternalLink } from './ExternalLink';

/* ─────────── DETAIL RAIL — Tracklist ─────────── */

export function DetailRail() {
  const { t } = useTranslation();
  const itemId = useUi((s) => s.detailItemId);
  const setTrack = useUi((s) => s.setTrack);
  const selectedTrackId = useUi((s) => s.detailTrackId);
  const { data: item } = useItem(itemId);
  const { data: tracks = [] } = useTracks(item?.release.id ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lyricsText, setLyricsText] = useState('');
  const lyricsCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const first = tracks[0];
    if (first && !selectedTrackId) setTrack(first.id);
  }, [tracks, selectedTrackId, setTrack]);

  const onTrackClick = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;

    if (trackId === expandedId) {
      setExpandedId(null);
      setLyricsText('');
      return;
    }

    setTrack(trackId);
    setExpandedId(trackId);

    const cached = lyricsCache.current.get(trackId);
    if (cached) {
      setLyricsText(cached);
      return;
    }

    if (track.lyrics) {
      lyricsCache.current.set(trackId, track.lyrics);
      setLyricsText(track.lyrics);
      return;
    }

    setLyricsText('');

    const registry = getProvidersRegistry();
    const providers = registry.lyricsProviders();
    const artist = item?.release?.artist ?? '';
    const title = track.title;

    async function load() {
      for (const p of providers) {
        const result = await p.getLyrics(artist, title);
        if (result) {
          lyricsCache.current.set(trackId, result.text);
          setLyricsText(result.text);
          return;
        }
      }
    }
    void load();
  };

  if (!itemId || tracks.length === 0) {
    return <p className="text-fg-body-subtle text-sm">{!itemId ? '' : t('layout:rail.detail.tracklist_empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-fg-heading text-lg font-semibold">{t('layout:rail.detail.tracklist')}</h3>
      <nav className="flex flex-col" aria-label={t('layout:rail.detail.tracklist_aria')}>
        {tracks.map((tr) => {
          const active = tr.id === selectedTrackId;
          const isExpanded = tr.id === expandedId;
          return (
            <div key={tr.id}>
              <button
                type="button"
                onClick={() => onTrackClick(tr.id)}
                aria-pressed={active}
                className={
                  'rounded-base group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-all duration-200 ' +
                  (active
                    ? 'text-fg-brand-strong bg-surface shadow-neu-inset'
                    : 'text-fg-body hover:text-fg-heading bg-surface hover:shadow-neu-2xs')
                }
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex w-6 shrink-0 items-center gap-1">
                    {active ? <PlayIcon /> : <MusicNoteIcon />}
                    <span className="text-fg-body-subtle text-xs font-medium">{tr.position}</span>
                  </span>
                  <span className="truncate font-medium">{tr.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {tr.lyrics && !isExpanded ? (
                    <Badge tone="brand" pill>
                      {t('layout:rail.detail.lyrics_badge')}
                    </Badge>
                  ) : null}
                  {isExpanded ? (
                    <span className="text-fg-body-subtle">
                      <CollapseIcon />
                    </span>
                  ) : null}
                  {tr.duration ? (
                    <span className="text-fg-body-subtle text-xs">
                      {formatDuration(tr.duration)}
                    </span>
                  ) : null}
                </div>
              </button>
              {isExpanded && lyricsText ? (
                <div className="border-border-default bg-surface/50 border-t px-4 py-4">
                  <pre className="text-fg-body whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {lyricsText}
                  </pre>
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* ─── Videos ─── */}
      <VideoRail />
    </div>
  );
}

function VideoRail() {
  const { t } = useTranslation();
  const videos = useUi((s) => s.releaseVideos);

  if (videos.length === 0) return null;

  return (
    <div>
      <h4 className="text-fg-body-subtle mb-3 text-xs font-medium uppercase tracking-wide">
        {t('layout:rail.detail.video')}
      </h4>
      <div className="flex flex-col gap-2">
        {videos.map((v, i) => (
          <ExternalLink
            key={i}
            href={v.uri}
            className="rounded-base hover:shadow-neu-2xs flex items-center gap-2.5 border border-transparent bg-transparent px-4 py-2.5 text-sm transition-all duration-200"
          >
            <VideoIcon />
            <span className="text-fg-body hover:text-fg-heading truncate">{v.title}</span>
          </ExternalLink>
        ))}
      </div>
    </div>
  );
}

/* ─────────── COLLECTION RAIL — Stats & Filters ─────────── */

function CollectionRail() {
  const { t } = useTranslation();
  const { data: items = [] } = useItems({});
  const search = useUi((s) => s.search);
  const filterType = useUi((s) => s.filterType);
  const filterTags = useUi((s) => s.filterTags);
  const sort = useUi((s) => s.sort);
  const setSearch = useUi((s) => s.setSearch);
  const setFilterType = useUi((s) => s.setFilterType);
  const setFilterTags = useUi((s) => s.setFilterTags);
  const setSort = useUi((s) => s.setSort);
  const [localSearch, setLocalSearch] = useState(search);

  const typeLabels: Record<string, string> = {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };

  const typeFilterOptions: Array<{ value: 'all' | MediaType; label: string }> = [
    { value: 'all', label: t('collection:filter.all') },
    { value: 'vinyl', label: t('collection:filter.vinyl') },
    { value: 'cd', label: t('collection:filter.cd') },
    { value: 'cassette', label: t('collection:filter.cassette') },
    { value: 'other', label: t('collection:filter.other') },
  ];

  const sortOptions: Array<{
    value: 'addedDesc' | 'addedAsc' | 'titleAsc' | 'artistAsc' | 'yearDesc';
    label: string;
  }> = [
    { value: 'addedDesc', label: t('collection:sort.added_desc') },
    { value: 'addedAsc', label: t('collection:sort.added_asc') },
    { value: 'titleAsc', label: t('collection:sort.title_asc') },
    { value: 'artistAsc', label: t('collection:sort.artist_asc') },
    { value: 'yearDesc', label: t('collection:sort.year_desc') },
  ];

  const stats = useMemo(() => {
    const total = items.length;
    const byType: Record<string, number> = {};
    for (const it of items) {
      byType[it.type] = (byType[it.type] ?? 0) + 1;
    }
    return { total, byType };
  }, [items]);

  const charts = useMemo(() => {
    const yearMap: Record<string, number> = {};
    const genreMap: Record<string, number> = {};
    for (const it of items) {
      const y = it.release.year ? String(it.release.year) : '?';
      yearMap[y] = (yearMap[y] ?? 0) + 1;
      for (const g of it.release.genres) {
        genreMap[g] = (genreMap[g] ?? 0) + 1;
      }
    }
    const yearEntries = Object.entries(yearMap).sort(([a], [b]) => (a === '?' ? 1 : b === '?' ? -1 : Number(a) - Number(b)));
    const genreEntries = Object.entries(genreMap).sort(([, a], [, b]) => b - a);
    return { yearEntries, genreEntries };
  }, [items]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      for (const t of it.tags ?? []) set.add(t);
    }
    return [...set].sort();
  }, [items]);

  const hasFilters = filterType !== 'all' || search !== '' || filterTags.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Search */}
      <div>
        <h3 className="text-fg-heading mb-3 text-lg font-semibold">{t('layout:rail.collection.stats')}</h3>
        <Input
          placeholder={t('collection:search.placeholder')}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch(localSearch);
          }}
          data-search-input
        />
      </div>

      {/* Stats */}
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
      </div>

      {/* Charts */}
      {items.length > 0 ? (
        <div>
          <h3 className="text-fg-heading mb-3 text-lg font-semibold">{t('layout:rail.collection.charts')}</h3>

          {/* By year */}
          {charts.yearEntries.length > 0 ? (
            <div className="mb-4">
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('layout:rail.collection.by_year')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-4 py-3">
                <BarChart data={charts.yearEntries} maxBars={15} />
              </div>
            </div>
          ) : null}

          {/* By genre */}
          {charts.genreEntries.length > 0 ? (
            <div>
              <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                {t('layout:rail.collection.by_genre')}
              </h4>
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-4 py-3">
                <BarChart data={charts.genreEntries} maxBars={10} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Tag filter */}
      {allTags.length > 0 ? (
        <div>
          <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
            {t('layout:rail.collection.filter_tags')}
          </h4>
          <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex flex-wrap gap-1 border p-2">
            {allTags.map((tag) => {
              const active = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? filterTags.filter((t) => t !== tag)
                      : [...filterTags, tag];
                    setFilterTags(next);
                  }}
                  className={`rounded-base px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
                    active
                      ? 'bg-surface text-fg-brand-strong shadow-neu-sm border border-border-default'
                      : 'text-fg-body-subtle hover:text-fg-body border border-transparent hover:shadow-neu-2xs'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Media type filter */}
      <VerticalGroup label={t('collection:filter.media_type')}>
        {typeFilterOptions.map((opt) => {
          const active = opt.value === filterType;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilterType(opt.value)}
              className={`rounded-base w-full px-3 py-2 text-left text-xs font-medium transition-all duration-200 ${
                active
                  ? 'bg-surface text-fg-brand-strong shadow-neu-sm border border-border-default'
                  : 'text-fg-body-subtle hover:text-fg-body border border-transparent hover:shadow-neu-2xs'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </VerticalGroup>

      {/* Sort */}
      <VerticalGroup label={t('collection:sort.label')}>
        {sortOptions.map((opt) => {
          const active = opt.value === sort;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSort(opt.value)}
              className={`rounded-base w-full px-3 py-2 text-left text-xs font-medium transition-all duration-200 ${
                active
                  ? 'bg-surface text-fg-brand-strong shadow-neu-sm border border-border-default'
                  : 'text-fg-body-subtle hover:text-fg-body border border-transparent hover:shadow-neu-2xs'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </VerticalGroup>

      {/* Active filters summary */}
      {hasFilters ? (
        <div>
          <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
            {t('layout:rail.collection.active_filters')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {filterType !== 'all' ? (
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className="rounded-base bg-surface text-fg-brand-strong shadow-neu-2xs hover:shadow-neu-xs active:shadow-neu-inset inline-flex items-center gap-1 border border-transparent px-3 py-1.5 text-xs font-medium transition-all duration-200"
              >
                {typeLabels[filterType]}
                <span aria-hidden>&times;</span>
              </button>
            ) : null}
            {search ? (
              <span className="rounded-base bg-surface text-fg-body shadow-neu-2xs border border-transparent px-3 py-1.5 text-xs font-medium">
                «{search}»
              </span>
            ) : null}
            {filterTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTags(filterTags.filter((t) => t !== tag))}
                className="rounded-base bg-surface text-fg-brand-strong shadow-neu-2xs hover:shadow-neu-xs active:shadow-neu-inset inline-flex items-center gap-1 border border-transparent px-3 py-1.5 text-xs font-medium transition-all duration-200"
              >
                {tag}
                <span aria-hidden>&times;</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VerticalGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
        {label}
      </h4>
      <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex flex-col gap-0.5 border p-1.5">
        {children}
      </div>
    </div>
  );
}

/* ─────────── ADD RAIL — Tips ─────────── */

function AddRail() {
  const { t } = useTranslation();
  const addTracklist = useUi((s) => s.addTracklist);
  const addTracklistLoading = useUi((s) => s.addTracklistLoading);
  const addReleaseMeta = useUi((s) => s.addReleaseMeta);

  /* ─── No release selected — show tips ─── */
  if (!addTracklist.length && !addTracklistLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-fg-heading mb-3 text-lg font-semibold">{t('layout:rail.add.tips')}</h3>
          <ul className="flex flex-col gap-3">
            <li className="rounded-base border-border-default bg-surface shadow-neu-2xs border px-5 py-4 text-sm">
              <span className="text-fg-heading block text-xs font-semibold">{t('layout:rail.add.barcode')}</span>
              <span className="text-fg-body-subtle text-xs">
                {t('layout:rail.add.barcode_desc')}
              </span>
            </li>
            <li className="rounded-base border-border-default bg-surface shadow-neu-2xs border px-5 py-4 text-sm">
              <span className="text-fg-heading block text-xs font-semibold">{t('layout:rail.add.catalog')}</span>
              <span className="text-fg-body-subtle text-xs">
                {t('layout:rail.add.catalog_desc')}
              </span>
            </li>
            <li className="rounded-base border-border-default bg-surface shadow-neu-2xs border px-5 py-4 text-sm">
              <span className="text-fg-heading block text-xs font-semibold">{t('layout:rail.add.manual')}</span>
              <span className="text-fg-body-subtle text-xs">
                {t('layout:rail.add.manual_desc')}
              </span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  /* ─── Release selected — show album info + tracklist ─── */
  return (
    <div className="flex flex-col gap-5">
      {/* Album info */}
      {addReleaseMeta ? (
        <div>
          <h3 className="text-fg-heading mb-3 text-lg font-semibold">{t('layout:rail.add.about_album')}</h3>
          <div className="rounded-base border-border-default bg-surface shadow-neu-inset divide-border-default divide-y border">
            {addReleaseMeta.country ? (
              <div className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm">
                <span className="text-fg-body-subtle">{t('layout:rail.add.country')}</span>
                <span className="text-fg-heading font-medium">{addReleaseMeta.country}</span>
              </div>
            ) : null}
            {addReleaseMeta.released ? (
              <div className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm">
                <span className="text-fg-body-subtle">{t('layout:rail.add.release')}</span>
                <span className="text-fg-heading font-medium">{addReleaseMeta.released}</span>
              </div>
            ) : null}
            {addReleaseMeta.format ? (
              <div className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm">
                <span className="text-fg-body-subtle">{t('layout:rail.add.format')}</span>
                <span className="text-fg-heading text-right font-medium">
                  {addReleaseMeta.format}
                </span>
              </div>
            ) : null}
            {addReleaseMeta.labels?.length ? (
              <div className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm">
                <span className="text-fg-body-subtle">{t('layout:rail.add.label')}</span>
                <span className="text-fg-heading text-right font-medium">
                  {addReleaseMeta.labels.join(', ')}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Tracklist */}
      <div>
        <h3 className="text-fg-heading mb-3 text-lg font-semibold">{t('layout:rail.add.tracklist')}</h3>
        {addTracklistLoading ? (
          <p className="text-fg-body-subtle text-sm">{t('common:loading.generic')}</p>
        ) : (
          <nav className="flex flex-col" aria-label={t('layout:rail.add.tracklist')}>
            {addTracklist.map((t, i) => (
              <div
                key={`${t.position}-${i}`}
                className="rounded-base text-fg-body flex w-full items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <MusicNoteIcon />
                  <span className="text-fg-body-subtle w-5 shrink-0 text-xs font-medium">
                    {t.position}
                  </span>
                  <span className="text-fg-heading truncate font-medium">{t.title}</span>
                </div>
                {t.durationMs ? (
                  <span className="text-fg-body-subtle shrink-0 text-xs">
                    {formatDuration(t.durationMs)}
                  </span>
                ) : null}
              </div>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

/* ─────────── SETTINGS RAIL — App Info ─────────── */

function SettingsRail() {
  const { t } = useTranslation();
  const discogsToken = useSettings((s) => s.discogsToken);
  const hasToken = Boolean(discogsToken);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void getAppInfo().then(setAppInfo);
  }, []);

  const commitLink = appInfo?.commit ? `${appInfo.repo}/commit/${appInfo.commit}` : appInfo?.repo;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-fg-heading mb-3.5 text-sm font-semibold uppercase tracking-wide">
          {t('layout:rail.settings.integrations')}
        </h3>
        <div
          className={
            hasToken
              ? 'rounded-base border-border-default bg-surface shadow-neu-2xs border px-6 py-5'
              : 'rounded-base border-border-warning bg-warning-soft border px-6 py-5'
          }
        >
          <div className="flex items-start gap-3.5">
            <div
              className={
                hasToken
                  ? 'rounded-base bg-surface shadow-neu-inset flex h-10 w-10 shrink-0 items-center justify-center'
                  : 'rounded-base bg-surface flex h-10 w-10 shrink-0 items-center justify-center'
              }
            >
              <VinylIcon />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-fg-heading text-sm font-semibold">Discogs</span>
                <Badge tone={hasToken ? 'success' : 'warning'} pill>
                  {hasToken ? t('layout:rail.settings.discogs_configured') : t('layout:rail.settings.discogs_missing')}
                </Badge>
              </div>
              <p className="text-fg-body-subtle mt-1.5 text-xs leading-snug">
                {hasToken
                  ? t('layout:rail.settings.discogs_ok')
                  : t('layout:rail.settings.discogs_no_token')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <SupportRail />

      <div>
        <h4 className="text-fg-body-subtle mb-3 text-xs font-medium uppercase tracking-wide">
          {t('layout:rail.settings.about')}
        </h4>
        <div className="rounded-base border-border-default bg-surface shadow-neu-inset divide-border-default divide-y border">
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-fg-body-subtle">{t('layout:rail.settings.version')}</span>
            <ExternalLink
              href={appInfo?.repo ? `${appInfo.repo}/releases` : '#'}
              className="text-fg-heading hover:text-fg-brand font-medium transition-colors"
            >
              {appInfo?.version ?? '—'}
            </ExternalLink>
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-fg-body-subtle">{t('layout:rail.settings.build')}</span>
            <ExternalLink
              href={commitLink ?? '#'}
              className="text-fg-heading hover:text-fg-brand font-mono text-xs transition-colors"
            >
              {appInfo?.commit ? appInfo.commit : '—'}
            </ExternalLink>
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-fg-body-subtle">{t('layout:rail.settings.platform')}</span>
            <span className="text-fg-heading font-medium">{appInfo?.target ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-fg-body-subtle">{t('layout:rail.settings.built_at')}</span>
            <span className="text-fg-heading font-mono text-xs">
              {appInfo?.builtAt
                ? new Date(appInfo.builtAt).toISOString().slice(0, 16).replace('T', ' ')
                : '—'}
            </span>
          </div>
        </div>
        {appInfo?.repo ? (
          <ExternalLink
            href={appInfo.repo}
            className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading mt-2 flex items-center gap-2.5 px-4 py-3 text-xs transition-all duration-200"
          >
            <ExternalLinkIcon />
            {t('layout:rail.settings.open_github')}
          </ExternalLink>
        ) : null}
      </div>

      <div>
        <h4 className="text-fg-body-subtle mb-3 text-xs font-medium uppercase tracking-wide">
          {t('layout:rail.settings.external_links')}
        </h4>
        <ul className="flex flex-col gap-1.5">
          {[
            { name: 'MusicBrainz', url: 'https://musicbrainz.org' },
            { name: 'Cover Art Archive', url: 'https://coverartarchive.org' },
            {
              name: t('layout:rail.settings.discogs_dev'),
              url: 'https://www.discogs.com/settings/developers',
            },
            { name: 'Genius', url: 'https://genius.com' },
          ].map((src) => (
            <li key={src.name}>
              <ExternalLink
                href={src.url}
                className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 px-4 py-3 text-xs transition-all duration-200"
              >
                <ExternalLinkIcon />
                {src.name}
              </ExternalLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─────────── SUPPORT RAIL — Donations ─────────── */

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinejoin="round" />
    </svg>
  );
}

function CryptoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SupportRail() {
  const { t } = useTranslation();

  return (
    <div>
      <h4 className="text-fg-body-subtle mb-3 text-xs font-medium uppercase tracking-wide">
        {t('layout:rail.settings.support')}
      </h4>
      <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex flex-col gap-3 border px-6 py-5">
        <ExternalLink
          href="https://boosty.to/annenskei/donate"
          className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 px-2 py-2 text-sm transition-all duration-200"
        >
          <HeartIcon />
          {t('settings:support.boosty')}
        </ExternalLink>
        <ExternalLink
          href="https://dalink.to/annenskei"
          className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 px-2 py-2 text-sm transition-all duration-200"
        >
          <HeartIcon />
          {t('settings:support.donationalerts')}
        </ExternalLink>
        <details className="group">
          <summary className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex cursor-pointer items-center gap-2.5 px-2 py-2 text-sm transition-all duration-200">
            <CryptoIcon />
            <span className="text-fg-heading font-medium">Crypto</span>
          </summary>
          <div className="mt-2 space-y-2 border-t border-border-default pt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-fg-body-subtle shrink-0 w-14">Bitcoin</span>
              <code className="rounded-sm bg-surface px-2 py-0.5 text-[11px] break-all select-all shadow-neu-2xs">
                bc1qvuhvewu3rjth80wnpdxkrl6vwtgjtspszkcqap
              </code>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-fg-body-subtle shrink-0 w-14">Ethereum</span>
              <code className="rounded-sm bg-surface px-2 py-0.5 text-[11px] break-all select-all shadow-neu-2xs">
                0xc126080ffD216827A37850a5511cf1273E303E73
              </code>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-fg-body-subtle shrink-0 w-14">Solana</span>
              <code className="rounded-sm bg-surface px-2 py-0.5 text-[11px] break-all select-all shadow-neu-2xs">
                516jeJxi1gwaRH7aEEiopAUAGNHKMrUxWv4cfGm32GhB
              </code>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ─────────── EXPORT ─────────── */

export function RightRail() {
  const { t } = useTranslation();
  const page = useUi((s) => s.page);
  const detailItemId = useUi((s) => s.detailItemId);

  const content = () => {
    switch (page) {
      case 'detail':
        return detailItemId ? <DetailRail /> : null;
      case 'collection':
        return <CollectionRail />;
      case 'add':
        return <AddRail />;
      case 'settings':
        return <SettingsRail />;
    }
  };

  const rendered = content();
  if (!rendered) return null;

  return (
    <aside
      aria-label={t('layout:sidebar.aria')}
      className="rounded-base border-border-default bg-surface shadow-neu-sm scrollbar-neu flex h-[calc(100vh-3rem)] w-0 shrink-0 flex-col overflow-hidden border opacity-0 transition-all duration-200 ease-in-out sm:h-[calc(100vh-3.5rem)] lg:w-72 lg:opacity-100"
    >
      <div className="flex h-full w-72 flex-col gap-4 overflow-y-auto px-6 py-6">{rendered}</div>
    </aside>
  );
}

/* ─────────── BAR CHART (neumorphic) ─────────── */

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
            <div
              className="rounded-base bg-surface border-border-default shadow-neu-2xs relative h-5 flex-1 overflow-hidden border"
            >
              <div
                className="bg-surface border-border-default-medium shadow-neu-xs h-full rounded-[5px] border"
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

/* ─────────── HELPERS ─────────── */

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MusicNoteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-fg-body-subtle h-3 w-3 shrink-0"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-fg-brand h-2.5 w-2.5 shrink-0"
      aria-hidden
    >
      <path d="M6 3l15 9-15 9V3z" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3 w-3"
      aria-hidden
    >
      <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-fg-body-subtle h-3.5 w-3.5 shrink-0"
      aria-hidden
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M10 9l5 3-5 3V9z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3 w-3 shrink-0"
      aria-hidden
    >
      <path
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VinylIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-fg-body h-5 w-5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}
