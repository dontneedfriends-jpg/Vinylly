import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Textarea, Badge, Input, PageHeader, ConditionPicker, TagInput } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useSettings } from '../lib/settings-store';
import { useItem, useUpdateItem, useRemoveItem, useWantlist, useItems } from '../lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { CoverImage } from '../components/CoverImage';
import { Gallery } from '../components/Gallery';
import { ExternalLink } from '../components/ExternalLink';
import { MasterVariants } from '../components/MasterVariants';
import { BackButton } from '../components/BackButton';
import { getProvidersRegistry } from '../lib/providers';
import type { ItemRecord } from '@vinylly/db';
import { itemRepo } from '../lib/db';
import { getHostShell } from '@vinylly/host';
import { stripMarkup } from '../lib/text';
import { useUndoableDelete } from '../lib/undo-delete';
import { useTypeLabels } from '../lib/type-labels';

export function DetailPage() {
  const { t } = useTranslation();
  const itemId = useUi((s) => s.detailItemId);
  const typeLabels = useTypeLabels();

  const openCollection = useUi((s) => s.openCollection);
  const openArtist = useUi((s) => s.openArtist);
  const setReleaseVideos = useUi((s) => s.setReleaseVideos);
  const { data: item, isFetched } = useItem(itemId);
  const allItemsQuery = useItems({});
  const { data: wantlist = [] } = useWantlist();
  const updateItem = useUpdateItem();

  const [notes, setNotes] = useState(item?.notes ?? '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [purchasePrice, setPurchasePrice] = useState<number | null>(item?.purchasePrice ?? null);
  const [sleeveCondition, setSleeveCondition] = useState(item?.sleeveCondition ?? '');
  const [mediaCondition, setMediaCondition] = useState(item?.mediaCondition ?? '');
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [lightboxTrigger, setLightboxTrigger] = useState(0);
  const [albumNotes, setAlbumNotes] = useState<string | null>(null);
  const [wikipediaHtml, setWikipediaHtml] = useState<string | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [extendedMeta, setExtendedMeta] = useState<{
    country?: string;
    released?: string;
    labels?: string[];
    format?: string;
    community?: { have: number; want: number; rating?: { average: number; count: number } };
    discogsUrl?: string;
    barcode?: string[];
    numForSale?: number;
    lowestPrice?: number | null;
    videos?: Array<{ uri: string; title: string }>;
    extraArtists?: Array<{ name: string; role: string }>;
  } | null>(null);
  const removeItem = useRemoveItem();
  const queryClient = useQueryClient();
  const showToast = useUi((s) => s.showToast);
  const hideToast = useUi((s) => s.hideToast);
  const discogsUsername = useSettings((s) => s.discogsUsername);
  const discogsSyncEnabled = useSettings((s) => s.discogsSyncEnabled);

  const syncDiscogsDelete = (itemArg: ItemRecord | undefined | null) => {
    if (!itemArg || !discogsUsername || !discogsSyncEnabled) return;
    if (itemArg.release.source !== 'discogs' || itemArg.discogsInstanceId == null) return;
    const registry = getProvidersRegistry();
    void registry.removeFromDiscogsCollection(discogsUsername, Number(itemArg.release.sourceId), itemArg.discogsInstanceId);
  };

  const { schedule, pending, clearPending } = useUndoableDelete<ItemRecord>(
    useCallback(
      (deleteTarget, clear) => {
        removeItem.mutate(deleteTarget.id, {
          onSuccess: () => {
            hideToast();
            void queryClient.invalidateQueries({ queryKey: ['items'] });
            void queryClient.invalidateQueries({ queryKey: ['item', deleteTarget.id] });
            syncDiscogsDelete(deleteTarget);
          },
          onError: (err) => {
            clear();
            hideToast();
            showToast(t('collection:item.delete_error', { error: String(err) }));
          },
        });
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [removeItem, hideToast, showToast, queryClient, t, discogsUsername, discogsSyncEnabled],
    ),
  );

  const itemIdKey = item?.id;
  useEffect(() => {
    const current = item;
    if (current) {
      setNotes(current.notes ?? '');
      setLocation(current.location ?? '');
      setPurchasePrice(current.purchasePrice ?? null);
      setSleeveCondition(current.sleeveCondition ?? '');
      setMediaCondition(current.mediaCondition ?? '');
      setTags(current.tags ?? []);
    }
    // Switching items invalidates any pending delete on the previous one
    clearPending();
    // Reset scroll to top on item change so the user sees the cover/hero, not
    // a mid-page section carried over from the previous item.
    if (itemIdKey) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    // Re-seed form state only when switching to a different item — not on every refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdKey]);

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
          numForSale: detailRelease.numForSale,
          lowestPrice: detailRelease.lowestPrice,
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
        // persist market data to DB
        if ((detailRelease.numForSale != null || detailRelease.lowestPrice != null) && !cancelled) {
          itemRepo
            .setReleaseMarketData(rel.id, {
              lowestPrice: detailRelease.lowestPrice ?? null,
              numForSale: detailRelease.numForSale ?? null,
            })
            .catch((err) => {
              console.warn('[detail] persist market data failed:', err);
            });
        }
        // persist community stats (used for hidden gems on stats page)
        if (detailRelease.community && !cancelled) {
          itemRepo
            .setReleaseCommunityStats(rel.id, {
              have: detailRelease.community.have ?? null,
              want: detailRelease.community.want ?? null,
              ratingAvg: detailRelease.community.rating?.average ?? null,
              ratingCount: detailRelease.community.rating?.count ?? null,
            })
            .catch((err) => {
              console.warn('[detail] persist community stats failed:', err);
            });
        }
      }
      const tryTitles = [rel.title, `${rel.title} (album)`, `${rel.title} (music)`];
      let found = false;
      for (const t of tryTitles) {
        if (cancelled) break;
        const wikiTitle = t.replace(/\s+/g, '_').replace(/[^\wа-яА-ЯёЁ\s_-]/g, '');
        try {
          const shell = getHostShell();
          const data = await shell.net().fetchJson<{ extract?: string }>(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`,
          );
          if (!cancelled) {
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
  }, [item, item?.release.sourceId, item?.release.source, setReleaseVideos]);

  if (!itemId) {
    return (
      <section>
        <PageHeader title={t('detail:page.no_release')} />
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
          <Button onClick={openCollection}>{t('detail:page.to_collection')}</Button>
        </div>
      </section>
    );
  }
  if (!item && !isFetched) {
    return (
      <section>
        <PageHeader title={t('detail:page.loading')} />
      </section>
    );
  }
  if (!item) {
    return (
      <section>
        <PageHeader title={t('detail:page.no_release')} />
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
          <Button onClick={openCollection}>{t('detail:page.to_collection')}</Button>
        </div>
      </section>
    );
  }
  if (pending?.id === item.id) {
    return (
      <section>
        <PageHeader title={t('detail:page.no_release')} />
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
          <Button onClick={openCollection}>{t('detail:page.to_collection')}</Button>
        </div>
      </section>
    );
  }

  const onSaveMeta = () => {
    if (!item) return;
    updateItem.mutate({
      id: item.id,
      patch: {
        notes: notes || null,
        location: location || null,
        purchasePrice: purchasePrice,
        sleeveCondition: sleeveCondition || null,
        mediaCondition: mediaCondition || null,
        tags,
      },
    });
  };

  const onDelete = () => {
    schedule(item, t('detail:page.deleted_undo', { title: item.release.title }));
  };


  return (
    <section className="animate-rise">
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
              elevated={false}
              onClick={() => setLightboxTrigger((n) => n + 1)}
            />
          </div>
          <Gallery
            releaseId={item.release.id}
            images={item.release.images}
            openTrigger={lightboxTrigger}
          />
          <div className="mt-3">
            <CoverUploadButton
              releaseId={item.release.id}
              currentLabel={t('detail:hero.update_cover')}
            />
          </div>
        </div>

        {/* Key Info */}
        <div className="flex flex-1 flex-col justify-start gap-4">
          <div>
            <h1 className="text-fg-heading text-3xl font-semibold md:text-4xl">
              {item.release.title}
            </h1>
            <button
              type="button"
              onClick={() => openArtist(item.release.artist)}
              className="text-fg-body hover:text-fg-heading mt-1 text-left text-lg transition-colors"
            >
              {item.release.artist}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="brand" pill>
              {typeLabels[item.type]}
            </Badge>
            {item.release.year ? <Badge tone="neu">{item.release.year}</Badge> : null}
            {item.release.genres.slice(0, 4).map((g) => (
              <Badge key={g} tone="neu">
                {g}
              </Badge>
            ))}
            {extendedMeta?.discogsUrl ? (
              <ExternalLink
                href={extendedMeta.discogsUrl}
                className="rounded-base bg-surface shadow-neu-2xs hover:shadow-neu-xs text-fg-brand hover:text-fg-brand-strong ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-neu"
              >
                <VinylIcon />
                <span>{t('detail:about.open_discogs')}</span>
                <ExternalLinkIcon />
              </ExternalLink>
            ) : null}
          </div>

          {item.barcode || item.catalogNumber ? (
            <div className="rounded-base border-border-default bg-surface shadow-neu-inset inline-flex flex-wrap gap-x-6 gap-y-1 border px-5 py-4 text-sm">
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

          <div className="flex items-center gap-2">
            <BackButton onClick={openCollection} label={t('detail:page.to_collection')} />
            <Button
              variant="danger"
              onClick={onDelete}
              leftIcon={<TrashIcon />}
            >
              {t('detail:page.delete')}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Full-width Info Sections ─── */}
      <div className="mt-10 flex flex-col gap-8">
        {/* Об альбоме */}
        {albumNotes || wikipediaHtml || extendedMeta || aboutLoading ? (
          <section>
            <h2 className="text-fg-heading mb-5 text-lg font-semibold">{t('detail:about.title')}</h2>
            {aboutLoading ? (
              <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
                <p className="text-fg-body-subtle text-sm">{t('detail:about.loading')}</p>
              </div>
            ) : (
              <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
                <div className="flex flex-col gap-6">
                  {extendedMeta ? (
                    <div className="rounded-base border-border-default bg-surface shadow-neu-inset grid border p-2 gap-x-8 md:grid-cols-2">
                      {extendedMeta.country ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.country')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.country}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.released ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.release_date')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.released}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.format ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.format')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.format}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.labels?.length ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.label')}</span>
                          <span className="text-fg-heading text-right text-sm font-medium">
                            {extendedMeta.labels.join(', ')}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.barcode?.length ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.barcode')}</span>
                          <span className="text-fg-heading text-right font-mono text-xs font-medium">
                            {extendedMeta.barcode.join(', ')}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.community ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">
                            {t('detail:about.have_want')}
                          </span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.community.have} / {extendedMeta.community.want}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.community?.rating ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.rating')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            ★ {extendedMeta.community.rating.average.toFixed(2)} ({extendedMeta.community.rating.count})
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.numForSale != null ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.for_sale')}</span>
                          <span className="text-fg-heading text-sm font-medium">{extendedMeta.numForSale}</span>
                        </div>
                      ) : null}
                      {extendedMeta.lowestPrice != null ? (
                        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.lowest_price')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            ${extendedMeta.lowestPrice.toFixed(2)}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.extraArtists?.length ? (
                        <div className="col-span-full flex flex-col gap-1 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.artists')}</span>
                          <span className="text-fg-heading text-sm font-medium">
                            {extendedMeta.extraArtists
                              .map((a) => `${a.name}${a.role ? ` (${a.role})` : ''}`)
                              .join(', ')}
                          </span>
                        </div>
                      ) : null}
                      {extendedMeta.discogsUrl ? (
                        <div className="flex items-center gap-2 px-4 py-2.5">
                          <span className="text-fg-body-subtle text-sm">{t('detail:about.discogs')}</span>
                          <ExternalLink
                            href={extendedMeta.discogsUrl}
                            className="text-fg-brand hover:text-fg-brand-strong inline-flex items-center gap-1 text-sm underline underline-offset-2"
                          >
                            <span>{t('detail:about.open')}</span>
                            <ExternalLinkIcon />
                          </ExternalLink>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {albumNotes ? (
                    <div>
                      <span className="text-fg-body-subtle block text-xs font-medium">
                        {t('detail:about.notes_discogs')}
                      </span>
                      <p className="text-fg-body mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                        {stripMarkup(albumNotes)}
                      </p>
                    </div>
                  ) : null}
                  {wikipediaHtml ? (
                    <div>
                      <span className="text-fg-body-subtle block text-xs font-medium">
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
          <h2 className="text-fg-heading mb-5 text-lg font-semibold">{t('detail:my_notes.title')}</h2>
          <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
              <Input
                label={t('detail:my_notes.location')}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Input
                label={t('detail:my_notes.purchase_price')}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={purchasePrice ?? ''}
                onChange={(e) => setPurchasePrice(e.target.value ? Number(e.target.value) : null)}
              />
              <ConditionPicker
                label={t('detail:my_notes.sleeve')}
                value={sleeveCondition}
                onChange={setSleeveCondition}
              />
              <ConditionPicker
                label={t('detail:my_notes.media')}
                value={mediaCondition}
                onChange={setMediaCondition}
              />
            </div>
            <div className="mt-5">
              <TagInput
                label={t('detail:my_notes.tags')}
                tags={tags}
                onChange={setTags}
                placeholder={t('detail:my_notes.tags_placeholder')}
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

        {/* ─── Master variants (collapsible, default closed) ─── */}
        {item.release.source === 'discogs' && item.release.masterId ? (
          <details className="rounded-base border-border-default bg-surface shadow-neu-md group mt-8 border">
            <summary className="text-fg-heading hover:text-fg-heading/90 flex cursor-pointer list-none items-center gap-3 px-6 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              <span className="text-fg-body-subtle inline-flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-200 group-open:rotate-90">
                <ChevronRightIcon />
              </span>
              {t('detail:variants.title')}
            </summary>
            <div className="px-6 pb-6">
              <MasterVariants
                masterId={item.release.masterId}
                ownedItems={allItemsQuery.data ?? []}
                wantedReleases={wantlist}
                currentSourceId={item.release.sourceId}
              />
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

/* ─── Cover Upload ─── */

async function renderThumbnail(file: File, maxSide: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    );
    if (!blob) throw new Error('toBlob failed');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

function CoverUploadButton({ releaseId, currentLabel }: { releaseId: string; currentLabel: string }) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const showToast = useUi((s) => s.showToast);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast(t('detail:cover_upload.too_large'));
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast(t('detail:cover_upload.invalid_type'));
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.match(/\.(png|jpg|jpeg|webp)$/i)?.[1] ?? 'jpg';
      const shell = getHostShell();
      const coversDir = shell.paths().coversDir;
      await shell.fs().ensureDir(coversDir);
      const coverPath = shell.fs().join(coversDir, `${releaseId}-custom.${ext}`);
      const coverBytes = new Uint8Array(await file.arrayBuffer());
      await shell.fs().writeBinary(coverPath, coverBytes);
      // Generate a real thumbnail by drawing the original to an off-screen canvas
      const thumbBytes = await renderThumbnail(file, 400);
      const thumbPath = shell.fs().join(coversDir, `${releaseId}_thumb.jpg`);
      await shell.fs().writeBinary(thumbPath, thumbBytes);
      await itemRepo.setReleaseCover(releaseId, {
        coverPath,
        thumbPath,
        coverRemote: coverPath,
        thumbRemote: thumbPath,
      });
      await queryClient.invalidateQueries({ queryKey: ['item', releaseId] });
    } catch (err) {
      console.warn('[cover-upload] failed:', err);
      showToast(t('detail:cover_upload.error'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <label className="rounded-base border-border-default bg-surface text-fg-body hover:text-fg-heading shadow-neu-2xs hover:shadow-neu-xs inline-flex cursor-pointer items-center gap-2 border px-3 py-1.5 text-xs font-medium transition-neu">
      <UploadIcon />
      <span>{uploading ? '…' : currentLabel}</span>
      <input type="file" accept="image/*" onChange={onChange} className="hidden" />
    </label>
  );
}

/* ─── Icons ─── */

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 16V4M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
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

function VinylIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
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

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
