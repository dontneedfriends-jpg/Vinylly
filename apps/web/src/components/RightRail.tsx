import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItem, useItems, useTracks } from '../lib/queries';
import { getProvidersRegistry } from '../lib/providers';
import { useSettings } from '../lib/settings-store';
import { getAppInfo, type AppInfo } from '../lib/app-info';
import type { MediaType } from '@vinylly/db';

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
          <a
            key={i}
            href={v.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-base hover:shadow-neu-2xs flex items-center gap-2.5 border border-transparent bg-transparent px-4 py-2.5 text-sm transition-all duration-200"
          >
            <VideoIcon />
            <span className="text-fg-body hover:text-fg-heading truncate">{v.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ─────────── COLLECTION RAIL — Stats & Filters ─────────── */

function CollectionRail() {
  const { t } = useTranslation();
  const { data: items = [] } = useItems({});
  const filterType = useUi((s) => s.filterType);
  const search = useUi((s) => s.search);
  const setFilterType = useUi((s) => s.setFilterType);

  const typeLabels: Record<string, string> = {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };

  const stats = useMemo(() => {
    const total = items.length;
    const byType: Record<string, number> = {};
    for (const it of items) {
      byType[it.type] = (byType[it.type] ?? 0) + 1;
    }
    return { total, byType };
  }, [items]);

  const hasFilters = filterType !== 'all' || search !== '';

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div>
        <h3 className="text-fg-heading mb-3 text-lg font-semibold">{t('layout:rail.collection.stats')}</h3>
        <div className="rounded-base border-border-default bg-surface shadow-neu-inset border px-6 py-5">
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
      </div>

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
          </div>
        </div>
      ) : null}
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

      <div>
        <h4 className="text-fg-body-subtle mb-3 text-xs font-medium uppercase tracking-wide">
          {t('layout:rail.settings.about')}
        </h4>
        <div className="rounded-base border-border-default bg-surface shadow-neu-inset divide-border-default divide-y border">
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-fg-body-subtle">{t('layout:rail.settings.version')}</span>
            <a
              href={appInfo?.repo ? `${appInfo.repo}/releases` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-heading hover:text-fg-brand font-medium transition-colors"
            >
              {appInfo?.version ?? '—'}
            </a>
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-fg-body-subtle">{t('layout:rail.settings.build')}</span>
            <a
              href={commitLink ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-heading hover:text-fg-brand font-mono text-xs transition-colors"
            >
              {appInfo?.commit ? appInfo.commit : '—'}
            </a>
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
          <a
            href={appInfo.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading mt-2 flex items-center gap-2.5 px-4 py-3 text-xs transition-all duration-200"
          >
            <ExternalLinkIcon />
            {t('layout:rail.settings.open_github')}
          </a>
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
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 px-4 py-3 text-xs transition-all duration-200"
              >
                <ExternalLinkIcon />
                {src.name}
              </a>
            </li>
          ))}
        </ul>
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
