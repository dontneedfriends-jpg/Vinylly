import { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  Input,
  Textarea,
  Badge,
} from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useCreateItem, useDefaultCollection } from '../lib/queries';
import { itemRepo } from '@vinylly/db';
import {
  ensureReleaseAssets,
  ProvidersRegistry,
  type SearchResult,
  type NormalizedRelease,
} from '@vinylly/media-providers';
import { getHostShell } from '@vinylly/host';
import type { MediaType, CreateItemInput } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';

const typeOptions: Array<{ value: MediaType; label: string }> = [
  { value: 'vinyl', label: 'Винил' },
  { value: 'cd', label: 'CD' },
  { value: 'cassette', label: 'Кассета' },
  { value: 'other', label: 'Другое' },
];

export function AddPage() {
  const openCollection = useUi((s) => s.openCollection);
  const openSearch = useUi((s) => s.openSearch);
  const { data: collection } = useDefaultCollection();
  const createItem = useCreateItem();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<NormalizedRelease | null>(null);
  const [releaseDetail, setReleaseDetail] = useState<NormalizedRelease | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [type, setType] = useState<MediaType>('vinyl');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [barcode, setBarcode] = useState('');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const registry = new ProvidersRegistry({});
      const r = await registry.searchAll({ text: query.trim() });
      setResults(r.slice(0, 12));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const onPickResult = async (res: SearchResult) => {
    setSelected(res.release);
    setLoadingDetail(true);
    setError(null);
    try {
      const registry = new ProvidersRegistry({});
      const providers = registry.all();
      const provider = providers.find((p) => p.name === res.provider);
      const detail = provider ? await provider.getRelease(res.release.sourceId) : null;
      setReleaseDetail(detail ?? res.release);
    } catch (e) {
      setError((e as Error).message);
      setReleaseDetail(res.release);
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
  };

  const onSave = async () => {
    if (!selected || !collection) return;
    setSaving(true);
    setError(null);
    try {
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
        tags: [],
      };
      const created = await createItem.mutateAsync(input);
      // кешируем обложку после создания записи
      const assets = await ensureReleaseAssets(selected, created.release.id);
      if (assets.coverPath || assets.coverRemote) {
        await itemRepo.setReleaseCover(created.release.id, {
          coverPath: assets.coverPath,
          thumbPath: assets.thumbPath,
          coverRemote: assets.coverRemote || null,
          thumbRemote: assets.thumbRemote,
        });
      }
      // подготовим директории на хосте
      const shell = getHostShell();
      await shell.fs().ensureDir(shell.paths().coversDir);
      openCollection();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <header className="mb-8">
        <h2 className="text-fg-heading">Добавить релиз</h2>
        <p className="text-fg-body-subtle text-sm">
          Найдите релиз в источниках или добавьте вручную.
        </p>
      </header>

      {!selected ? (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Input
                    label="Что искать"
                    placeholder="Название, артист, штрих-код или каталожный номер"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void onSearch();
                    }}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={onSearch} disabled={searching || !query.trim()}>
                    {searching ? 'Ищу…' : 'Найти'}
                  </Button>
                  <Button variant="neutral" onClick={onManual}>
                    Вручную
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm text-[#d04545]">{error}</p> : null}
              {results.length > 0 ? (
                <ul className="grid list-none grid-cols-2 gap-6 p-0 md:grid-cols-3 lg:grid-cols-4">
                  {results.map((r, i) => (
                    <li key={`${r.provider}-${r.release.sourceId}-${i}`}>
                      <Card
                        variant="interactive"
                        as="button"
                        onClick={() => void onPickResult(r)}
                        className="w-full text-left"
                      >
                        <CardBody>
                          <div className="flex flex-col gap-3">
                            <div className="aspect-square">
                              <CoverImage
                                releaseId={`${r.provider}-${r.release.sourceId}`}
                                coverPath={null}
                                coverRemote={r.release.thumbUrl ?? r.release.coverUrl}
                                alt={r.release.title}
                                size="thumb"
                              />
                            </div>
                            <div>
                              <div className="text-fg-heading line-clamp-2 text-sm font-semibold">
                                {r.release.title}
                              </div>
                              <div className="text-fg-body-subtle line-clamp-1 text-xs">
                                {r.release.artist}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <Badge tone="secondary">{r.provider}</Badge>
                              {r.release.year ? (
                                <span className="text-fg-body-subtle text-xs">
                                  {r.release.year}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!searching && results.length === 0 ? (
                <p className="text-fg-body-subtle text-sm">
                  Введите запрос для поиска. Если ничего не найдено — добавьте релиз вручную.
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : (
        <ReleaseForm
          release={releaseDetail ?? selected}
          loadingDetail={loadingDetail}
          type={type}
          onType={setType}
          notes={notes}
          onNotes={setNotes}
          location={location}
          onLocation={setLocation}
          barcode={barcode}
          onBarcode={setBarcode}
          catalogNumber={catalogNumber}
          onCatalogNumber={setCatalogNumber}
          onBack={() => {
            setSelected(null);
            setReleaseDetail(null);
          }}
          onSearch={openSearch}
          onSave={() => void onSave()}
          saving={saving}
          error={error}
        />
      )}
    </section>
  );
}

interface ReleaseFormProps {
  release: NormalizedRelease;
  loadingDetail: boolean;
  type: MediaType;
  onType: (t: MediaType) => void;
  notes: string;
  onNotes: (v: string) => void;
  location: string;
  onLocation: (v: string) => void;
  barcode: string;
  onBarcode: (v: string) => void;
  catalogNumber: string;
  onCatalogNumber: (v: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}

function ReleaseForm(p: ReleaseFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-fg-heading">{p.release.title}</h3>
            <p className="text-fg-body-subtle text-sm">{p.release.artist}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="neutral" onClick={p.onBack}>
              Назад к поиску
            </Button>
            <Button onClick={p.onSave} disabled={p.saving}>
              {p.saving ? 'Сохраняю…' : 'В коллекцию'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <div className="aspect-square w-full max-w-[200px]">
            <CoverImage
              releaseId={`${p.release.source}-${p.release.sourceId}`}
              coverPath={null}
              coverRemote={p.release.thumbUrl ?? p.release.coverUrl}
              alt={p.release.title}
              size="full"
            />
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <label className="text-fg-heading mb-2 block text-sm font-medium">Тип носителя</label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((o) => {
                  const active = p.type === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => p.onType(o.value)}
                      aria-pressed={active}
                      className={
                        'rounded-base border px-3 py-1.5 text-sm transition-all duration-200 ease-in-out ' +
                        (active
                          ? 'bg-surface border-border-default text-fg-heading shadow-neu-inset'
                          : 'bg-surface border-border-default text-fg-body shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset')
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              label="Штрих-код"
              value={p.barcode}
              onChange={(e) => p.onBarcode(e.target.value)}
            />
            <Input
              label="Каталожный номер"
              value={p.catalogNumber}
              onChange={(e) => p.onCatalogNumber(e.target.value)}
            />
            <Input
              label="Где хранится"
              placeholder="Полка, коробка, шкаф…"
              value={p.location}
              onChange={(e) => p.onLocation(e.target.value)}
            />
            <Textarea
              label="Заметки"
              placeholder="Состояние, особенности, история покупки…"
              value={p.notes}
              onChange={(e) => p.onNotes(e.target.value)}
            />
            {p.error ? <p className="text-sm text-[#d04545]">{p.error}</p> : null}
            {p.loadingDetail ? (
              <p className="text-fg-body-subtle text-xs">Загружаю детали релиза…</p>
            ) : null}
            {p.release.tracklist.length > 0 ? (
              <div>
                <h4 className="text-fg-heading mb-2">Треклист</h4>
                <ol className="text-fg-body list-decimal space-y-1 pl-6 text-sm">
                  {p.release.tracklist.map((t, i) => (
                    <li key={`${t.position}-${i}`}>
                      <span className="text-fg-heading">{t.title}</span>
                      {t.durationMs ? (
                        <span className="text-fg-body-subtle">
                          {' '}
                          ({formatDuration(t.durationMs)})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </CardBody>
      <CardFooter>
        <p className="text-fg-body-subtle text-xs">
          Источник: {p.release.source}. Поля «Состояние» и «Теги» можно отредактировать после
          добавления на странице деталей.
        </p>
      </CardFooter>
    </Card>
  );
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
