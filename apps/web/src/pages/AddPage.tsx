import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  Button,
  Input,
  Textarea,
  Badge,
  PageHeader,
  SegmentedControl,
  ConditionPicker,
  TagInput,
  EmptyState,
  SkeletonCard,
} from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useSettings } from '../lib/settings-store';
import { useCreateItem, useDefaultCollection, useItems, useRemoveItem, useAddToWantlist, useRemoveFromWantlist, useWantlist } from '../lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { itemRepo } from '../lib/db';
import {
  ensureReleaseAssets,
  type SearchResult,
  type NormalizedRelease,
} from '@vinylly/media-providers';
import { getHostShell } from '@vinylly/host';
import type { MediaType, CreateItemInput, ItemRecord } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';
import { Gallery } from '../components/Gallery';
import { BackButton } from '../components/BackButton';
import { BulkAddPanel } from '../components/BulkAddPanel';
import { getProvidersRegistry } from '../lib/providers';
import { useUndoableDelete } from '../lib/undo-delete';
import { useTypeLabels } from '../lib/type-labels';

const discogsFormatMap: Record<string, string | undefined> = {
  Vinyl: 'Vinyl',
  CD: 'CD',
  Cassette: 'Cassette',
  '': undefined,
};

export function AddPage() {
  const { t } = useTranslation();
  const setAddTracklist = useUi((s) => s.setAddTracklist);
  const setAddReleaseMeta = useUi((s) => s.setAddReleaseMeta);
  const { data: collection } = useDefaultCollection();
  const createItem = useCreateItem();
  const removeItem = useRemoveItem();
  const queryClient = useQueryClient();
  const showToast = useUi((s) => s.showToast);
  const hideToast = useUi((s) => s.hideToast);
  const { data: allItems = [] } = useItems({});
  const { data: wantlist = [] } = useWantlist();
  const addToWantlist = useAddToWantlist();
  const wantlistRemove = useRemoveFromWantlist();
  const discogsUsername = useSettings((s) => s.discogsUsername);
  const discogsSyncEnabled = useSettings((s) => s.discogsSyncEnabled);
  const discogsPriceFieldId = useSettings((s) => s.discogsPriceFieldId);

  const typeLabels = useTypeLabels();

  const { schedule: scheduleDelete } = useUndoableDelete<ItemRecord>(
    useCallback(
      (snapshot, clear) => {
        const shouldSync =
          discogsUsername &&
          discogsSyncEnabled &&
          snapshot.discogsInstanceId != null &&
          snapshot.release.source === 'discogs';
        removeItem.mutate(snapshot.id, {
          onSuccess: () => {
            hideToast();
            void queryClient.invalidateQueries({ queryKey: ['items'] });
            void queryClient.invalidateQueries({ queryKey: ['item', snapshot.id] });
            if (shouldSync) {
              void getProvidersRegistry().removeFromDiscogsCollection(
                discogsUsername!,
                Number(snapshot.release.sourceId),
                snapshot.discogsInstanceId!,
              );
            }
          },
          onError: (err) => {
            clear();
            hideToast();
            showToast(t('collection:item.delete_error', { error: String(err) }));
          },
        });
      },
      [removeItem, hideToast, showToast, queryClient, discogsUsername, discogsSyncEnabled, t],
    ),
  );

  const formatFilterOptions: Array<{ value: string; label: string }> = [
    { value: '', label: t('common:filter.all') },
    { value: 'Vinyl', label: t('common:media.vinyl') },
    { value: 'CD', label: t('common:media.cd') },
    { value: 'Cassette', label: t('common:media.cassette') },
  ];

  const [query, setQuery] = useState('');
  const [addMode, setAddMode] = useState<'search' | 'bulk'>('search');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<NormalizedRelease | null>(null);
  const [releaseDetail, setReleaseDetail] = useState<NormalizedRelease | null>(null);
  const [, setLoadingDetail] = useState(false);

  const [type, setType] = useState<MediaType>('vinyl');
  const [syncDiscogs, setSyncDiscogs] = useState(true);
  const [formatFilter, setFormatFilter] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [barcode, setBarcode] = useState('');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sleeveCondition, setSleeveCondition] = useState('');
  const [mediaCondition, setMediaCondition] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [coverLightboxTrigger, setCoverLightboxTrigger] = useState(0);

  const onSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const registry = getProvidersRegistry();
      const r = await registry.searchAll({
        text: query.trim(),
        mediaType: discogsFormatMap[formatFilter],
      });
      setResults(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const onPickResult = async (res: SearchResult) => {
    setSelected(res.release);
    const detected = res.release.mediaType as MediaType | undefined;
    if (detected && typeLabels[detected]) setType(detected);
    setLoadingDetail(true);
    setAddTracklist(res.release.tracklist, true);
    setError(null);
    try {
      const registry = getProvidersRegistry();
      const providers = registry.all();
      const provider = providers.find((p) => p.name === res.provider);
      const detail = provider ? await provider.getRelease(res.release.sourceId) : null;
      setReleaseDetail(detail ?? res.release);
      setAddTracklist((detail ?? res.release).tracklist, false);

      const release = detail ?? res.release;
      const raw = (release as unknown as Record<string, unknown>).raw as
        Record<string, unknown> | undefined;
      const catno = (raw?.labels as Array<Record<string, unknown>> | undefined)?.[0]?.catno as
        string | undefined;
      if (catno) setCatalogNumber(catno);
      if (release.barcode?.[0]) setBarcode(release.barcode[0]);
      setAddReleaseMeta({
        country: release.country ?? null,
        released: release.released ?? null,
        labels: release.labels ?? null,
        format: release.format ?? null,
        barcode: release.barcode ?? null,
      });
    } catch (e) {
      setError((e as Error).message);
      setReleaseDetail(res.release);
      setAddTracklist(res.release.tracklist, false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const onManual = () => {
    setSelected({
      source: 'manual',
      sourceId: `manual-${Date.now()}`,
      title: t('add:manual.default_title'),
      artist: t('add:manual.default_artist'),
      year: null,
      genres: [],
      styles: [],
      coverUrl: null,
      thumbUrl: null,
      tracklist: [],
    });
    setReleaseDetail(null);
    setAddTracklist([], false);
    setAddReleaseMeta(null);
  };

  const onBackToSearch = () => {
    setSelected(null);
    setReleaseDetail(null);
    setAddTracklist([], false);
    setAddReleaseMeta(null);
  };

  const existingItem = useMemo(() => {
    if (!selected) return null;
    return (
      allItems.find(
        (it) =>
          it.release.source === selected.source &&
          it.release.sourceId === selected.sourceId,
      ) ?? null
    );
  }, [allItems, selected]);

  const existingWantlist = useMemo(() => {
    if (!selected) return null;
    return wantlist.find((w) => w.release.source === selected.source && w.release.sourceId === selected.sourceId) ?? null;
  }, [wantlist, selected]);

  const onSave = async () => {
    if (!selected || !collection) return;
    setSaving(true);
    setError(null);
    try {
      const existing = await itemRepo.findBySource(selected.source, selected.sourceId);
      if (existing) {
        setError(t('add:form.duplicate', { title: existing.release.title }));
        setSaving(false);
        return;
      }
      const input: CreateItemInput = {
        collectionId: collection.id,
        type,
        release: {
          source: selected.source,
          sourceId: selected.sourceId,
          title: selected.title,
          artist: selected.artist,
          year: selected.year,
          masterId: (releaseDetail ?? selected).masterId,
          genres: selected.genres,
          styles: selected.styles,
        },
        tracklist: (releaseDetail ?? selected).tracklist,
        notes: notes || null,
        location: location || null,
        barcode: barcode || null,
        catalogNumber: catalogNumber || null,
        purchasePrice: purchasePrice,
        sleeveCondition: sleeveCondition || null,
        mediaCondition: mediaCondition || null,
        tags,
      };
      const created = await createItem.mutateAsync(input);
      const assets = await ensureReleaseAssets(releaseDetail ?? selected, created.release.id);
      if (assets.coverPath || assets.coverRemote) {
        await itemRepo.setReleaseCover(created.release.id, {
          coverPath: assets.coverPath,
          thumbPath: assets.thumbPath,
          coverRemote: assets.coverRemote,
          thumbRemote: assets.thumbRemote,
        });
      }
      if (assets.images.length) {
        await itemRepo.setReleaseImages(created.release.id, assets.images);
      }
      const shell = getHostShell();
      await shell.fs().ensureDir(shell.paths().coversDir);
      // sync to Discogs
      if (syncDiscogs && discogsSyncEnabled && discogsUsername && selected.source === 'discogs') {
        const registry = getProvidersRegistry();
        const instanceId = await registry.addToDiscogsCollection(discogsUsername, Number(selected.sourceId));
        if (instanceId != null) {
          await itemRepo.update(created.id, { discogsInstanceId: instanceId });
          // Push condition fields entered in the form (1 = media, 2 = sleeve)
          if (mediaCondition || sleeveCondition) {
            void registry.syncConditionToDiscogs(discogsUsername, Number(selected.sourceId), instanceId, {
              mediaCondition: mediaCondition || null,
              sleeveCondition: sleeveCondition || null,
            });
          }
          // Push purchase price into the mapped custom field
          if (purchasePrice != null && discogsPriceFieldId != null) {
            void registry.syncPriceToDiscogs(
              discogsUsername,
              Number(selected.sourceId),
              instanceId,
              purchasePrice,
              discogsPriceFieldId,
            );
          }
        } else {
          showToast(t('add:form.discogs_sync_failed'));
        }
      }
      showToast(t('add:form.added_toast', { title: created.release.title }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onAddToWantlist = async () => {
    if (!selected) return;
    try {
      const detail = releaseDetail ?? selected;
      await addToWantlist.mutateAsync({
        release: {
          source: selected.source,
          sourceId: selected.sourceId,
          title: selected.title,
          artist: selected.artist,
          year: selected.year,
          masterId: detail.masterId,
          genres: selected.genres,
          styles: selected.styles,
          coverRemote: detail.coverUrl ?? null,
          thumbRemote: detail.thumbUrl ?? null,
        },
      });
      // also push to Discogs if token configured
      if (discogsUsername) {
        const registry = getProvidersRegistry();
        const synced = await registry.addToDiscogsWantlist(discogsUsername, Number(selected.sourceId));
        if (!synced) showToast(t('wantlist:add.discogs_sync_failed'));
      }
      showToast(t('wantlist:add.added_toast', { title: selected.title }));
    } catch (err) {
      console.warn('[wantlist] add failed:', err);
      showToast(t('wantlist:add.error', { error: String(err) }));
    }
  };

  const onRemoveFromWantlist = async () => {
    if (!existingWantlist) return;
    try {
      await wantlistRemove.mutateAsync(existingWantlist.id);
      if (discogsUsername) {
        const registry = getProvidersRegistry();
        const synced = await registry.removeFromDiscogsWantlist(
          discogsUsername,
          Number(existingWantlist.release.sourceId),
        );
        if (!synced) showToast(t('wantlist:add.discogs_sync_failed'));
      }
      showToast(t('wantlist:add.removed_toast', { title: existingWantlist.release.title }));
    } catch (err) {
      console.warn('[wantlist] remove failed:', err);
      showToast(t('wantlist:add.error', { error: String(err) }));
    }
  };

  const onRemoveFromCollection = () => {
    if (!existingItem) return;
    scheduleDelete(existingItem, t('add:form.removed_toast', { title: existingItem.release.title }));
  };

  if (!selected) {
    return (
      <section className="animate-rise">
        <PageHeader level="h1"
          title={t('add:page.title')}
          subtitle={t('add:page.subtitle')}
          actions={
            <SegmentedControl
              options={[
                { value: 'search', label: t('add:mode.single') },
                { value: 'bulk', label: t('add:mode.bulk') },
              ]}
              value={addMode}
              onChange={(v) => setAddMode(v as 'search' | 'bulk')}
              size="sm"
              ariaLabel={t('add:mode.aria')}
            />
          }
        />

        {addMode === 'bulk' ? (
          <BulkAddPanel />
        ) : (
          <>
        <Card className="mb-6">
          <CardBody>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Input
                  label={t('add:search.label')}
                  placeholder={t('add:search.placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void onSearch();
                  }}
                  data-search-input
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={onSearch} disabled={searching || !query.trim()}>
                  {searching ? t('add:search.button_searching') : t('add:search.button_search')}
                </Button>
                <Button variant="neutral" onClick={onManual}>
                  {t('add:search.button_manual')}
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-fg-heading mb-2 block text-sm font-medium">{t('add:search.filter_format')}</span>
              <SegmentedControl
                options={formatFilterOptions}
                value={formatFilter}
                onChange={(v) => setFormatFilter(v)}
                ariaLabel={t('add:search.filter_aria')}
                size="sm"
              />
            </div>
            {error ? <p className="text-fg-danger mt-3 text-sm">{error}</p> : null}
          </CardBody>
        </Card>

        {searching && results.length === 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i}>
                <SkeletonCard />
              </li>
            ))}
          </ul>
        ) : results.length === 0 && searching === false && error === null && query.trim() !== '' && !selected ? (
          <EmptyState
            title={t('add:search.no_results')}
            description={t('add:search.try_different')}
            action={
              <a
                href={`https://www.discogs.com/search/?q=${encodeURIComponent(query.trim())}&type=release`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-base bg-surface shadow-neu-sm hover:shadow-neu-md text-fg-heading inline-flex items-center gap-2 px-4 py-2 text-sm transition-neu"
              >
                {t('add:search.open_discogs_search')}
                <ExternalLinkIcon />
              </a>
            }
          />
        ) : results.length > 0 ? (
          <>
<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.slice(0, 24).map((r, i) => (
              <li
                key={`${r.provider}-${r.release.sourceId}-${i}`}
                className="animate-rise"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <Card
                  variant="interactive"
                  as="button"
                  onClick={() => void onPickResult(r)}
                  className="group relative h-full w-full overflow-hidden text-left"
                >
                  <div className="flex h-full flex-col p-5">
                    <div className="rounded-base shadow-neu-inset aspect-square overflow-hidden">
                      <CoverImage
                        releaseId={`${r.provider}-${r.release.sourceId}`}
                        coverPath={null}
                        coverRemote={r.release.thumbUrl ?? r.release.coverUrl}
                        alt={r.release.title}
                        size="thumb"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-end pt-5">
                      <div className="text-fg-body-subtle flex items-center gap-2 text-xs">
                        <VinylIcon />
                        <span>
                          {r.release.mediaType
                            ? (typeLabels[r.release.mediaType as MediaType] ?? r.release.mediaType)
                            : r.provider}
                        </span>
                        {r.release.year ? <span>· {r.release.year}</span> : null}
                      </div>
                      <h3 className="text-fg-heading mt-3 line-clamp-1 text-base font-semibold leading-tight">
                        {r.release.title}
                      </h3>
                      <p className="text-fg-body-subtle mt-1 line-clamp-1 text-sm leading-relaxed">
                        {r.release.artist}
                      </p>
                    </div>
                  </div>
                  </Card>
              </li>
            ))}
          </ul>
            {results.length > 24 ? (
              <p className="text-fg-body-subtle mt-3 text-xs">
                {t('add:search.more_results', { count: results.length - 24 })}
              </p>
            ) : null}
          </>
        ) : !searching && results.length === 0 ? (
          <p className="text-fg-body-subtle text-sm">{t('add:search.hint')}</p>
        ) : null}
          </>
        )}
      </section>
    );
  }

  return (
    <section className="animate-rise">
      <div className="w-full overflow-hidden text-left rounded-base border-border-default bg-surface shadow-neu-md border">
        <div className="flex flex-col gap-6 p-6 md:flex-row">
          <div className="w-full shrink-0 md:w-[180px]">
            <button
              type="button"
              className="rounded-base shadow-neu-xl aspect-square w-full overflow-hidden focus-visible:shadow-neu-xs focus-visible:border-border-default-strong cursor-pointer border-0 bg-transparent p-0"
              onClick={() => setCoverLightboxTrigger((n) => n + 1)}
              aria-label={selected?.title}
            >
              <CoverImage
                releaseId={`${selected.source}-${selected.sourceId}`}
                coverPath={null}
                coverRemote={selected.thumbUrl ?? selected.coverUrl}
                alt={selected.title}
                size="full"
              />
            </button>
            {releaseDetail?.images?.length ? (
              <Gallery
                openLightbox={coverLightboxTrigger}
                releaseId={`${selected.source}-${selected.sourceId}`}
                images={releaseDetail.images.map((img) => ({
                  type: img.type,
                  uri: img.uri,
                  localPath: null,
                }))}
              />
            ) : null}
          </div>
          <div className="flex flex-1 flex-col justify-start gap-3">
            <div>
              <h2 className="text-fg-heading text-xl font-semibold">
                {releaseDetail?.title ?? selected.title}
              </h2>
              <p className="text-fg-body mt-1 text-sm">
                {releaseDetail?.artist ?? selected.artist}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" pill>
                {typeLabels[type]}
              </Badge>
              {selected.year ? <Badge tone="neu">{selected.year}</Badge> : null}
              {selected.genres.slice(0, 3).map((g) => (
                <Badge key={g} tone="neu">
                  {g}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <BackButton onClick={onBackToSearch} label={t('common:button.back')} />
              {existingItem ? (
                <Button
                  variant="danger"
                  onClick={onRemoveFromCollection}
                  leftIcon={<TrashIcon />}
                >
                  {t('add:form.remove_from_collection')}
                </Button>
              ) : (
                <Button
                  onClick={() => void onSave()}
                  disabled={saving}
                  leftIcon={saving ? undefined : <CheckIcon />}
                >
                  {saving ? t('common:button.saving') : t('add:form.save_to_collection')}
                </Button>
              )}
              {existingWantlist ? (
                <Button
                  variant="neutral"
                  onClick={() => void onRemoveFromWantlist()}
                  leftIcon={<HeartIcon />}
                >
                  {t('wantlist:form.remove_from_wantlist')}
                </Button>
              ) : (
                <Button
                  variant="neutral"
                  onClick={() => void onAddToWantlist()}
                  disabled={addToWantlist.isPending}
                  leftIcon={addToWantlist.isPending ? undefined : <HeartIcon />}
                >
                  {addToWantlist.isPending ? t('common:button.saving') : t('wantlist:form.add_to_wantlist')}
                </Button>
              )}
              {selected?.source === 'discogs' && discogsUsername && discogsSyncEnabled ? (
                <label className="ml-2 inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-xs">
                  <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={syncDiscogs}
                      onChange={(e) => setSyncDiscogs(e.target.checked)}
                      className="peer absolute inset-0 cursor-pointer appearance-none"
                      aria-label={t('add:form.sync_discogs')}
                    />
                    <span
                      aria-hidden
                      className="rounded-base border-border-default-medium bg-surface shadow-neu-2xs peer-checked:border-border-brand peer-checked:shadow-neu-inset peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg-brand inline-block h-5 w-5 border"
                    />
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      className="text-fg-brand-strong pointer-events-none absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
                    >
                      <path d="M5 12l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-fg-body-subtle">{t('add:form.sync_discogs')}</span>
                </label>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Form ─── */}
      <div className="mt-8">
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
          <h3 className="text-fg-heading mb-6 text-lg font-semibold">{t('add:form.manual_title')}</h3>
          <div className="mb-6">
            <span className="text-fg-heading mb-2 block text-sm font-medium">{t('add:form.media_type')}</span>
            <SegmentedControl
              options={[
                { value: 'vinyl', label: t('common:media.label_vinyl') },
                { value: 'cd', label: t('common:media.label_cd') },
                { value: 'cassette', label: t('common:media.label_cassette') },
                { value: 'other', label: t('common:media.label_other') },
              ]}
              value={type}
              onChange={(v) => setType(v as MediaType)}
              size="sm"
            />
          </div>
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <Input label={t('add:form.barcode')} value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            <Input
              label={t('add:form.catalog_number')}
              value={catalogNumber}
              onChange={(e) => setCatalogNumber(e.target.value)}
            />
            <Input
              label={t('add:form.location')}
              placeholder={t('add:form.location_placeholder')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Input
              label={t('add:form.purchase_price')}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={purchasePrice ?? ''}
              onChange={(e) => setPurchasePrice(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="mt-6 grid gap-x-6 gap-y-5 md:grid-cols-2">
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
          <div className="mt-6">
            <Textarea
              label={t('add:form.notes')}
              placeholder={t('add:form.notes_placeholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-6">
            <TagInput
              label={t('add:form.tags')}
              tags={tags}
              onChange={setTags}
              placeholder={t('add:form.tags_placeholder')}
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-fg-danger mt-4 text-sm">{error}</p> : null}
    </section>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M14 4h6v6M10 14L20 4M19 13v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
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
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" strokeLinejoin="round" />
    </svg>
  );
}
