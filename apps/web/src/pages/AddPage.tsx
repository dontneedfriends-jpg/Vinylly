import { useState } from 'react';
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
import { useCreateItem, useDefaultCollection } from '../lib/queries';
import { itemRepo } from '../lib/db';
import {
  ensureReleaseAssets,
  type SearchResult,
  type NormalizedRelease,
} from '@vinylly/media-providers';
import { getHostShell } from '@vinylly/host';
import type { MediaType, CreateItemInput } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';
import { Gallery } from '../components/Gallery';
import { getProvidersRegistry } from '../lib/providers';

const discogsFormatMap: Record<string, string | undefined> = {
  Vinyl: 'Vinyl',
  CD: 'CD',
  Cassette: 'Cassette',
  '': undefined,
};

export function AddPage() {
  const { t } = useTranslation();
  const openCollection = useUi((s) => s.openCollection);
  const setAddTracklist = useUi((s) => s.setAddTracklist);
  const setAddReleaseMeta = useUi((s) => s.setAddReleaseMeta);
  const { data: collection } = useDefaultCollection();
  const createItem = useCreateItem();

  const typeLabels: Record<MediaType, string> = {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };

  const formatFilterOptions: Array<{ value: string; label: string }> = [
    { value: '', label: t('common:filter.all') },
    { value: 'Vinyl', label: t('common:media.vinyl') },
    { value: 'CD', label: t('common:media.cd') },
    { value: 'Cassette', label: t('common:media.cassette') },
  ];

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<NormalizedRelease | null>(null);
  const [releaseDetail, setReleaseDetail] = useState<NormalizedRelease | null>(null);
  const [, setLoadingDetail] = useState(false);
  const [type, setType] = useState<MediaType>('vinyl');
  const [formatFilter, setFormatFilter] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [barcode, setBarcode] = useState('');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sleeveCondition, setSleeveCondition] = useState('');
  const [mediaCondition, setMediaCondition] = useState('');
  const [tags, setTags] = useState<string[]>([]);

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
      title: 'Новый релиз',
      artist: 'Неизвестный артист',
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
          genres: selected.genres,
          styles: selected.styles,
        },
        tracklist: (releaseDetail ?? selected).tracklist,
        notes: notes || null,
        location: location || null,
        barcode: barcode || null,
        catalogNumber: catalogNumber || null,
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
      openCollection();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!selected) {
    return (
      <section className="animate-rise">
        <PageHeader
          title={t('add:page.title')}
          subtitle={t('add:page.subtitle')}
        />

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
          <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
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
          />
        ) : results.length > 0 ? (
          <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {results.map((r, i) => (
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
                      <h3 className="text-fg-heading mt-3 line-clamp-1 pl-3 text-base font-semibold leading-tight">
                        {r.release.title}
                      </h3>
                      <p className="text-fg-body-subtle mt-1 line-clamp-1 pl-3 text-sm leading-relaxed">
                        {r.release.artist}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : !searching && results.length === 0 ? (
          <p className="text-fg-body-subtle text-sm">{t('add:search.hint')}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="animate-rise">
      <PageHeader
        title={releaseDetail?.title ?? selected.title}
        subtitle={releaseDetail?.artist ?? selected.artist}
        actions={
          <div className="flex gap-2">
            <Button
              variant="neutral"
              onClick={() => {
                setSelected(null);
                setReleaseDetail(null);
                setAddTracklist([], false);
                setAddReleaseMeta(null);
              }}
              leftIcon={<BackIcon />}
            >
              {t('common:button.back')}
            </Button>
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? t('common:button.saving') : t('add:form.save_to_collection')}
            </Button>
          </div>
        }
      />

      {/* ─── Album preview card (like collection tile) ─── */}
      <Card variant="interactive" as="div" className="w-full overflow-hidden text-left">
        <div className="flex flex-col gap-6 p-8 md:flex-row">
          <div className="w-full shrink-0 md:w-[180px]">
            <div className="rounded-base shadow-neu-inset aspect-square overflow-hidden">
              <CoverImage
                releaseId={`${selected.source}-${selected.sourceId}`}
                coverPath={null}
                coverRemote={selected.thumbUrl ?? selected.coverUrl}
                alt={selected.title}
                size="full"
              />
            </div>
            {releaseDetail?.images?.length ? (
              <Gallery
                releaseId={`${selected.source}-${selected.sourceId}`}
                images={releaseDetail.images.map((img) => ({
                  type: img.type,
                  uri: img.uri,
                  localPath: null,
                }))}
              />
            ) : null}
          </div>
          <div className="flex flex-1 flex-col justify-center gap-3">
            <div>
              <h2 className="text-fg-heading text-xl font-semibold">
                {releaseDetail?.title ?? selected.title}
              </h2>
              <p className="text-fg-body mt-0.5 text-sm">
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
          </div>
        </div>
      </Card>

      {/* ─── Form ─── */}
      <div className="mt-8">
        <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-10">
          <h3 className="text-fg-heading mb-5 text-lg font-semibold">{t('add:form.manual_title')}</h3>
          <div className="mb-5">
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
          </div>
          <div className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2">
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
            <Textarea
              label={t('add:form.notes')}
              placeholder={t('add:form.notes_placeholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-5">
            <TagInput
              label={t('add:form.tags')}
              tags={tags}
              onChange={setTags}
              placeholder={t('add:form.tags_placeholder')}
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? t('common:button.saving') : t('add:form.save_to_collection')}
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="text-fg-danger mt-4 text-sm">{error}</p> : null}
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
