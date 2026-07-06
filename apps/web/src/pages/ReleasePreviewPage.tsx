import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, PageHeader, Badge, Card, CardBody } from '@vinylly/ui';
import type { MediaType, ReleaseRecord } from '@vinylly/db';
import { useUi } from '../lib/ui-store';
import { useDefaultCollection, useCreateItem, useItems, useRemoveFromWantlist, useWantlist } from '../lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { CoverImage } from '../components/CoverImage';
import { Gallery } from '../components/Gallery';
import { tryGetHostShell } from '@vinylly/host';

type ExtendedRelease = ReleaseRecord & {
  community?: { have: number; want: number; rating?: { average: number; count: number } };
  numForSale?: number | null;
  lowestPrice?: number | null;
  tracklist?: Array<{ position: string; title: string; duration?: string }>;
  notes?: string;
};

function detectMediaType(
  formats: string[] | undefined,
): MediaType {
  if (!formats?.length) return 'other';
  const lower = formats.map((f) => f.toLowerCase()).join(' ');
  if (/(vinyl|\blp\b|\bep\b)/.test(lower)) return 'vinyl';
  if (/(cd|\bdvd\b)/.test(lower)) return 'cd';
  if (/(cassette|\btape\b)/.test(lower)) return 'cassette';
  return 'other';
}

export function ReleasePreviewPage() {
  const { t } = useTranslation();
  const releaseId = useUi((s) => s.releasePreviewId);
  const openCollection = useUi((s) => s.openCollection);
  const openWantlist = useUi((s) => s.openWantlist);
  const showToast = useUi((s) => s.showToast);

  const { data: wantlist = [] } = useWantlist();
  const { data: items = [] } = useItems({});
  const { data: collection } = useDefaultCollection();
  const createItem = useCreateItem();
  const removeFromWantlist = useRemoveFromWantlist();
  const queryClient = useQueryClient();

  const [release, setRelease] = useState<ExtendedRelease | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<MediaType>('vinyl');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightboxTrigger, setLightboxTrigger] = useState(0);

  // Initial load: prefer existing DB entry from wantlist or items
  const existingFromDb = useMemo<ExtendedRelease | null>(() => {
    if (!releaseId) return null;
    const w = wantlist.find((entry) => entry.release.id === releaseId);
    if (w) return { ...w.release };
    const it = items.find((i) => i.release.id === releaseId);
    if (it) return { ...it.release };
    return null;
  }, [releaseId, wantlist, items]);

  useEffect(() => {
    if (!releaseId) return;
    let cancelled = false;
    setError(null);
    if (existingFromDb) {
      setRelease(existingFromDb);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const shell = tryGetHostShell();
      if (!shell) {
        setError(t('release_preview.no_shell'));
        setLoading(false);
        return;
      }
      try {
        const data = await shell.net().fetchJson<{
          id: number;
          title: string;
          artists: Array<{ name: string }>;
          year?: number;
          genres?: string[];
          styles?: string[];
          formats?: Array<{ name: string }>;
          cover_image?: string;
          thumb?: string;
          community?: { have: number; want: number; rating?: { average: number; count: number } };
          num_for_sale?: number;
          lowest_price?: number;
          tracklist?: Array<{ position: string; title: string; duration?: string }>;
          notes?: string;
        }>(`https://api.discogs.com/releases/${encodeURIComponent(releaseId)}`);
        if (cancelled) return;
        const fmts = data.formats?.map((f) => f.name) ?? [];
        const r: ExtendedRelease = {
          id: data.id.toString(),
          source: 'discogs',
          sourceId: data.id.toString(),
          title: data.title,
          artist: data.artists?.[0]?.name ?? '—',
          year: data.year ?? null,
          lowestPrice: data.lowest_price ?? null,
          numForSale: data.num_for_sale ?? null,
          trackCount: data.tracklist?.length ?? 0,
          totalDurationMs: null,
          masterId: null,
          communityHave: data.community?.have ?? null,
          communityWant: data.community?.want ?? null,
          communityRatingAvg: data.community?.rating?.average ?? null,
          communityRatingCount: data.community?.rating?.count ?? null,
          genres: data.genres ?? [],
          styles: data.styles ?? [],
          coverPath: null,
          thumbPath: null,
          coverRemote: data.cover_image ?? null,
          thumbRemote: data.thumb ?? null,
          images: [],
          tracklist: data.tracklist ?? [],
          notes: data.notes,
        };
        setType(detectMediaType(fmts));
        setRelease(r);
      } catch (err) {
        if (!cancelled) {
          console.warn('[release-preview] fetch failed:', err);
          setError(String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [releaseId, existingFromDb, t]);

  const inWantlist = useMemo(() => {
    if (!release) return null;
    return wantlist.find((w) => w.release.source === release.source && w.release.sourceId === release.sourceId) ?? null;
  }, [wantlist, release]);

  const alreadyOwned = useMemo(() => {
    if (!release) return null;
    return items.find((it) => it.release.source === release.source && it.release.sourceId === release.sourceId) ?? null;
  }, [items, release]);

  const onAdd = async () => {
    if (!release || !collection) return;
    setSaving(true);
    try {
      const formats = release.styles?.length ? release.styles : undefined;
      await createItem.mutateAsync({
        collectionId: collection.id,
        type,
        release: {
          source: release.source,
          sourceId: release.sourceId,
          title: release.title,
          artist: release.artist,
          year: release.year,
          masterId: release.masterId,
          genres: release.genres,
          styles: release.styles,
          coverRemote: release.coverRemote,
          thumbRemote: release.thumbRemote,
          ...(formats ? {} : {}),
        },
        tracklist: release.tracklist?.map((t) => ({
          position: t.position,
          title: t.title,
          duration: parseDuration(t.duration),
        })),
        notes: notes || null,
        location: location || null,
        purchasePrice,
      });
      // remove from wantlist if it was there
      if (inWantlist) {
        await removeFromWantlist.mutateAsync(inWantlist.id);
      }
      showToast(t('release_preview.added_toast', { title: release.title }));
      await queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['wantlist'] });
      // Navigate to the new item detail
      const newItem = items.find(
        (it) => it.release.source === release.source && it.release.sourceId === release.sourceId,
      );
      if (newItem) {
        useUi.getState().openDetail(newItem.id);
      } else {
        openCollection();
      }
    } catch (err) {
      console.warn('[release-preview] add failed:', err);
      showToast(t('release_preview.add_error', { error: String(err) }));
    } finally {
      setSaving(false);
    }
  };

  if (!releaseId) {
    return (
      <section className="animate-rise">
        <PageHeader level="h1" title={t('release_preview.no_release')} />
        <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />}>
          {t('common:button.back')}
        </Button>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="animate-rise">
        <PageHeader level="h1" title={t('common:loading.generic')} />
      </section>
    );
  }

  if (error && !release) {
    return (
      <section className="animate-rise">
        <PageHeader level="h1" title={t('release_preview.error_title')} />
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-8">
          <p className="text-fg-danger mb-4 text-sm">{error}</p>
          <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />}>
            {t('common:button.back')}
          </Button>
        </div>
      </section>
    );
  }

  if (!release) return null;

  const typeLabels: Record<MediaType, string> = {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };

  const community = release.communityHave != null || release.communityWant != null
    ? { have: release.communityHave ?? 0, want: release.communityWant ?? 0 }
    : null;

  return (
    <section className="animate-rise">
      <PageHeader
        level="h1"
        title={release.title}
        subtitle={t('release_preview.subtitle', { source: release.source })}
        actions={
          <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />} size="sm">
            {t('common:button.back')}
          </Button>
        }
      />

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Cover */}
        <div className="w-full shrink-0 md:w-[280px]">
          <div className="rounded-base shadow-neu-xl aspect-square w-full overflow-hidden">
            <CoverImage
              releaseId={release.id}
              coverPath={release.coverPath}
              coverRemote={release.coverRemote}
              alt={release.title}
              size="full"
              onClick={() => setLightboxTrigger((n) => n + 1)}
            />
          </div>
          <Gallery
            releaseId={release.id}
            images={release.images ?? []}
            openTrigger={lightboxTrigger}
          />
        </div>

        {/* Key info + actions */}
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="text-fg-heading text-3xl font-semibold md:text-4xl">{release.title}</h1>
            <button
              type="button"
              onClick={() => useUi.getState().openArtist(release.artist)}
              className="text-fg-body hover:text-fg-heading mt-1 text-left text-lg transition-colors"
            >
              {release.artist}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" pill>{typeLabels[type]}</Badge>
            {release.year ? <Badge tone="neu">{release.year}</Badge> : null}
            {release.genres.slice(0, 4).map((g) => (
              <Badge key={g} tone="neu">{g}</Badge>
            ))}
          </div>

          {/* Action card */}
          <Card className="mt-2">
            <CardBody className="space-y-3">
              {alreadyOwned ? (
                <>
                  <div className="text-fg-success-strong text-sm font-medium">
                    {t('release_preview.already_owned')}
                  </div>
                  <div className="text-fg-body-subtle text-xs">
                    {t('release_preview.already_owned_desc', {
                      title: alreadyOwned.release.title,
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => useUi.getState().openDetail(alreadyOwned.id)}
                      leftIcon={<CheckIcon />}
                    >
                      {t('release_preview.go_to_owned')}
                    </Button>
                    {inWantlist ? (
                      <Button
                        variant="neutral"
                        onClick={() => removeFromWantlist.mutate(inWantlist.id)}
                      >
                        {t('wantlist:form.in_wantlist')}
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-fg-heading text-sm font-medium">
                    {t('release_preview.add_to_collection')}
                  </div>
                  <div className="text-fg-body-subtle text-xs">
                    {inWantlist
                      ? t('release_preview.add_will_remove_from_wantlist')
                      : t('release_preview.add_subtitle')}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-fg-body-subtle">{t('add:form.media_type')}</span>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as MediaType)}
                        className="rounded-base border-border-default bg-surface shadow-neu-inset text-fg-heading px-3 py-2 text-sm"
                      >
                        <option value="vinyl">{t('common:media.label_vinyl')}</option>
                        <option value="cd">{t('common:media.label_cd')}</option>
                        <option value="cassette">{t('common:media.label_cassette')}</option>
                        <option value="other">{t('common:media.label_other')}</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-fg-body-subtle">{t('add:form.purchase_price')}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={purchasePrice ?? ''}
                        onChange={(e) => setPurchasePrice(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-base border-border-default bg-surface shadow-neu-inset text-fg-heading px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-fg-body-subtle">{t('detail:my_notes.location')}</span>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="rounded-base border-border-default bg-surface shadow-neu-inset text-fg-heading px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-body-subtle">{t('detail:my_notes.notes_label')}</span>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="rounded-base border-border-default bg-surface shadow-neu-inset text-fg-heading px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={onAdd} disabled={saving} leftIcon={saving ? undefined : <PlusIcon />}>
                      {saving ? t('common:button.saving') : t('release_preview.add_button')}
                    </Button>
                    {inWantlist ? (
                      <Button
                        variant="neutral"
                        onClick={() => removeFromWantlist.mutate(inWantlist.id)}
                      >
                        {t('wantlist:form.in_wantlist')}
                      </Button>
                    ) : null}
                    <Button variant="ghost" onClick={openWantlist}>
                      {t('release_preview.back_to_wantlist')}
                    </Button>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Snapshot facts */}
          <Card className="mt-2">
            <CardBody>
              <h3 className="text-fg-heading mb-3 text-sm font-semibold">
                {t('release_preview.facts')}
              </h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Fact label={t('add:form.media_type')} value={typeLabels[type]} />
                {release.year ? <Fact label={t('release_preview.year')} value={String(release.year)} /> : null}
                {release.genres.length ? <Fact label={t('release_preview.genres')} value={release.genres.join(', ')} /> : null}
                {release.styles.length ? <Fact label={t('release_preview.styles')} value={release.styles.join(', ')} /> : null}
                {community ? (
                  <>
                    <Fact label={t('release_preview.have')} value={community.have.toLocaleString()} />
                    <Fact label={t('release_preview.want')} value={community.want.toLocaleString()} />
                  </>
                ) : null}
                {release.lowestPrice != null ? (
                  <Fact
                    label={t('release_preview.lowest_price')}
                    value={`$${release.lowestPrice.toFixed(2)}`}
                  />
                ) : null}
                {release.numForSale != null ? (
                  <Fact
                    label={t('release_preview.for_sale')}
                    value={release.numForSale.toLocaleString()}
                  />
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {release.notes ? (
            <Card className="mt-2">
              <CardBody>
                <h3 className="text-fg-body-subtle mb-2 text-xs font-medium uppercase tracking-wide">
                  {t('detail:about.notes_discogs')}
                </h3>
                <p className="text-fg-body whitespace-pre-wrap text-sm leading-relaxed">
                  {release.notes}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Tracklist */}
      {release.tracklist && release.tracklist.length > 0 ? (
        <Card className="mt-8">
          <CardBody>
            <h3 className="text-fg-heading mb-3 text-sm font-semibold">
              {t('detail:tracklist.title')}
            </h3>
            <ol className="divide-border-default divide-y">
              {release.tracklist.map((t, i) => (
                <li
                  key={`${t.position}-${i}`}
                  className="text-fg-body grid grid-cols-[3rem_1fr_auto] items-center gap-3 py-2 text-sm"
                >
                  <span className="text-fg-body-subtle font-mono text-xs">{t.position}</span>
                  <span className="truncate">{t.title}</span>
                  {t.duration ? (
                    <span className="text-fg-body-subtle text-xs">{t.duration}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-fg-body-subtle text-[11px] uppercase tracking-wide">{label}</dt>
      <dd className="text-fg-heading mt-0.5 truncate text-sm">{value}</dd>
    </div>
  );
}

function parseDuration(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+):(\d+)/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (Number.isNaN(min) || Number.isNaN(sec)) return null;
  return (min * 60 + sec) * 1000;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M19 12H5m6-6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4" aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}