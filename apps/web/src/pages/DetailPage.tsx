import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Textarea, Badge, Input, PageHeader } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItem, useUpdateItem, useRemoveItem } from '../lib/queries';
import { CoverImage } from '../components/CoverImage';
import { DetailRail } from '../components/RightRail';
import { getProvidersRegistry } from '../lib/providers';
import type { MediaType } from '@vinylly/db';

export function DetailPage() {
  const { t } = useTranslation();
  const itemId = useUi((s) => s.detailItemId);
  const typeLabels: Record<MediaType, string> = {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };

  const openCollection = useUi((s) => s.openCollection);
  const setReleaseVideos = useUi((s) => s.setReleaseVideos);
  const { data: item } = useItem(itemId);
  const updateItem = useUpdateItem();

  const [notes, setNotes] = useState(item?.notes ?? '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [sleeveCondition, setSleeveCondition] = useState(item?.sleeveCondition ?? '');
  const [mediaCondition, setMediaCondition] = useState(item?.mediaCondition ?? '');
  const [albumNotes, setAlbumNotes] = useState<string | null>(null);
  const [wikipediaHtml, setWikipediaHtml] = useState<string | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [extendedMeta, setExtendedMeta] = useState<{
    country?: string;
    released?: string;
    labels?: string[];
    format?: string;
    community?: { have: number; want: number };
    discogsUrl?: string;
    barcode?: string[];
    videos?: Array<{ uri: string; title: string }>;
    extraArtists?: Array<{ name: string; role: string }>;
  } | null>(null);
  const removeItem = useRemoveItem();

  useEffect(() => {
    const current = item;
    if (current) {
      setNotes(current.notes ?? '');
      setLocation(current.location ?? '');
      setSleeveCondition(current.sleeveCondition ?? '');
      setMediaCondition(current.mediaCondition ?? '');
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const rel = item.release;
    if (!rel.sourceId) return;
    let cancelled = false;
    setAboutLoading(true);
    async function load() {
      const registry = getProvidersRegistry();
      const providers = registry.all();
      const provider = providers.find((p) => p.name === rel.source);
      const detailRelease = provider ? await provider.getRelease(rel.sourceId) : null;
      if (cancelled) return;
      const notes = (detailRelease as Record<string, unknown> | null)?.notes as string | undefined;
      setAlbumNotes(notes ?? null);
      if (detailRelease) {
        setExtendedMeta({
          country: detailRelease.country,
          released: detailRelease.released,
          labels: detailRelease.labels,
          format: detailRelease.format,
          community: detailRelease.community,
          discogsUrl: detailRelease.discogsUrl,
          barcode: detailRelease.barcode,
          videos: detailRelease.videos,
          extraArtists: detailRelease.extraArtists,
        });
        if (detailRelease.videos?.length) {
          setReleaseVideos(
            detailRelease.videos.map((v: { uri: string; title: string }) => ({
              uri: v.uri,
              title: v.title,
            })),
          );
        }
      }
      const tryTitles = [rel.title, `${rel.title} (album)`, `${rel.title} (music)`];
      let found = false;
      for (const t of tryTitles) {
        if (cancelled) break;
        const wikiTitle = t.replace(/\s+/g, '_').replace(/[^\wа-яА-ЯёЁ\s_-]/g, '');
        try {
          const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`,
          );
          if (res.ok && !cancelled) {
            const data = (await res.json()) as { extract?: string };
            setWikipediaHtml(data.extract ?? null);
            found = true;
            break;
          }
        } catch {
          // try next
        }
      }
      if (!found && !cancelled) setWikipediaHtml(null);
      setAboutLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [item, item?.release.sourceId, item?.release.source, item?.release.title, setReleaseVideos]);

  if (!itemId) {
    return (
      <section>
        <PageHeader title={t('detail:page.no_release')} />
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-10">
          <Button onClick={openCollection}>{t('detail:page.to_collection')}</Button>
        </div>
      </section>
    );
  }
  if (!item) {
    return (
      <section>
        <PageHeader title={t('detail:page.loading')} />
      </section>
    );
  }

  const onSaveMeta = () => {
    updateItem.mutate({
      id: item.id,
      patch: {
        notes: notes || null,
        location: location || null,
        sleeveCondition: sleeveCondition || null,
        mediaCondition: mediaCondition || null,
      },
    });
  };

  return (
    <section className="animate-rise">
      <PageHeader
        title={item.release.title}
        subtitle={item.release.artist}
        actions={
          <div className="flex gap-2">
            <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />}>
              {t('detail:page.to_collection')}
            </Button>
            <Button
              variant="neutral"
              onClick={() => {
                if (window.confirm(`${t('detail:page.delete')} «${item.release.title}»?`)) {
                  removeItem.mutate(item.id);
                  openCollection();
                }
              }}
              leftIcon={<TrashIcon />}
            >
              {t('detail:page.delete')}
            </Button>
          </div>
        }
      />

      {/* ─── Hero: Cover + Key Info ─── */}
      <div className="flex flex-col gap-8 md:flex-row">
        {/* Cover */}
        <div className="w-full shrink-0 md:w-[280px]">
          <div className="rounded-base shadow-neu-xl aspect-square w-full overflow-hidden">
            <CoverImage
              releaseId={item.release.id}
              coverPath={item.release.coverPath}
              coverRemote={item.release.coverRemote}
              alt={item.release.title}
              size="full"
            />
          </div>
        </div>

        {/* Key Info */}
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div>
            <h1 className="text-fg-heading text-3xl font-semibold md:text-4xl">
              {item.release.title}
            </h1>
            <p className="text-fg-body mt-1 text-lg">{item.release.artist}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="brand" pill>
              {typeLabels[item.type]}
            </Badge>
            {item.release.year ? <Badge tone="neutral">{item.release.year}</Badge> : null}
            {item.release.genres.slice(0, 4).map((g) => (
              <Badge key={g} tone="secondary">
                {g}
              </Badge>
            ))}
          </div>

          {item.barcode || item.catalogNumber ? (
            <div className="rounded-base border-border-default bg-surface shadow-neu-inset mt-2 inline-flex flex-wrap gap-x-6 gap-y-1 border px-5 py-4 text-sm">
              {item.barcode ? (
                <span>
                  <span className="text-fg-body-subtle">{t('detail:about.barcode')}: </span>
                  <span className="text-fg-heading font-medium">{item.barcode}</span>
                </span>
              ) : null}
              {item.catalogNumber ? (
                <span>
                  <span className="text-fg-body-subtle">{t('detail:about.catalog_number')}: </span>
                  <span className="text-fg-heading font-medium">{item.catalogNumber}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Full-width Info Sections ─── */}
      <div className="mt-10 flex flex-col gap-8">
        {/* Об альбоме */}
        {albumNotes || wikipediaHtml || extendedMeta || aboutLoading ? (
          <section>
            <h2 className="text-fg-heading mb-5 text-2xl font-semibold">{t('detail:about.title')}</h2>
            {aboutLoading ? (
              <div className="rounded-base border-border-default bg-surface shadow-neu-inset border p-10">
                <p className="text-fg-body-subtle text-sm">{t('detail:about.loading')}</p>
              </div>
            ) : (
              <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-10">
                <div className="flex flex-col gap-6">
                  {extendedMeta ? (
                    <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                      {extendedMeta.country ? (
                        <div className="border-border-default flex items-center justify-between gap-4 border-b pb-2">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.country')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.country}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.released ? (
                        <div className="border-border-default flex items-center justify-between gap-4 border-b pb-2">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.release_date')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.released}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.format ? (
                        <div className="border-border-default flex items-center justify-between gap-4 border-b pb-2">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.format')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.format}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.labels?.length ? (
                        <div className="border-border-default flex items-center justify-between gap-4 border-b pb-2">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.label')}</span>
                          <span className="text-fg-heading text-right text-sm font-medium">
                            {extendedMeta.labels.join(', ')}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.barcode?.length ? (
                        <div className="border-border-default flex items-center justify-between gap-4 border-b pb-2">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.barcode')}</span>
                          <span className="text-fg-heading text-right font-mono text-xs font-medium">
                            {extendedMeta.barcode.join(', ')}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.community ? (
                        <div className="border-border-default flex items-center justify-between gap-4 border-b pb-2">
                          <span className="text-fg-body-subtle text-sm">
                            {t('detail:about.have_want')}
                          </span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.community.have} / {extendedMeta.community.want}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.extraArtists?.length ? (
                        <div className="border-border-default col-span-full flex flex-col gap-1 border-b pb-2">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.artists')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.extraArtists
                              .map((a) => `${a.name}${a.role ? ` (${a.role})` : ''}`)
                              .join(', ')}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.discogsUrl ? (
                        <div className="flex items-center gap-2">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.discogs')}</span>
                          <a
                            href={extendedMeta.discogsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-fg-brand hover:text-fg-brand-strong inline-flex items-center gap-1 text-sm underline underline-offset-2"
                          >
                            <span>{t('detail:about.open')}</span>
                            <ExternalLinkIcon />
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {albumNotes ? (
                    <div>
                      <span className="text-fg-body-subtle block text-xs font-medium uppercase tracking-wide">
                        {t('detail:about.notes_discogs')}
                      </span>
                      <p className="text-fg-body mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                        {albumNotes}
                      </p>
                    </div>
                  ) : null}
                  {wikipediaHtml ? (
                    <div>
                      <span className="text-fg-body-subtle block text-xs font-medium uppercase tracking-wide">
                        {t('detail:about.wikipedia')}
                      </span>
                      <p className="text-fg-body mt-2 text-sm leading-relaxed">{wikipediaHtml}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {/* Мои заметки */}
        <section>
          <h2 className="text-fg-heading mb-5 text-2xl font-semibold">{t('detail:my_notes.title')}</h2>
          <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-10">
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
              <Input
                label={t('detail:my_notes.location')}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Input
                label={t('detail:my_notes.sleeve')}
                placeholder={t('detail:my_notes.sleeve_placeholder')}
                value={sleeveCondition}
                onChange={(e) => setSleeveCondition(e.target.value)}
              />
              <Input
                label={t('detail:my_notes.media')}
                placeholder={t('detail:my_notes.media_placeholder')}
                value={mediaCondition}
                onChange={(e) => setMediaCondition(e.target.value)}
              />
            </div>
            <div className="mt-5">
              <Textarea
                label={t('detail:my_notes.notes_label')}
                placeholder={t('detail:my_notes.notes_placeholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={onSaveMeta} disabled={updateItem.isPending}>
                {updateItem.isPending ? t('common:button.saving') : t('common:button.save')}
              </Button>
            </div>
          </div>
        </section>

        {/* Треклист и видео — показываем под заметками, когда правый рейл свёрнут */}
        <section className="mt-8 block lg:hidden">
          <h2 className="text-fg-heading mb-5 text-2xl font-semibold">{t('detail:tracklist.title')}</h2>
          <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-10">
            <DetailRail />
          </div>
        </section>
      </div>
    </section>
  );
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
