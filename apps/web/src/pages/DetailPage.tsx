import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Button, Textarea, Badge, Input } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItem, useTracks, useUpdateItem, useSetTrackLyrics } from '../lib/queries';
import { ProvidersRegistry } from '@vinylly/media-providers';
import { CoverImage } from '../components/CoverImage';
import type { MediaType } from '@vinylly/db';

const typeLabels: Record<MediaType, string> = {
  vinyl: 'Винил',
  cd: 'CD',
  cassette: 'Кассета',
  other: 'Другое',
};

export function DetailPage() {
  const itemId = useUi((s) => s.detailItemId);
  const setTrack = useUi((s) => s.setTrack);
  const selectedTrackId = useUi((s) => s.detailTrackId);
  const openCollection = useUi((s) => s.openCollection);
  const { data: item } = useItem(itemId);
  const { data: tracks = [] } = useTracks(item?.release.id ?? null);
  const updateItem = useUpdateItem();
  const setLyrics = useSetTrackLyrics();

  const [notes, setNotes] = useState(item?.notes ?? '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [sleeveCondition, setSleeveCondition] = useState(item?.sleeveCondition ?? '');
  const [mediaCondition, setMediaCondition] = useState(item?.mediaCondition ?? '');
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [lyricsSource, setLyricsSource] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

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
    const first = tracks[0];
    if (first && !selectedTrackId) setTrack(first.id);
  }, [tracks, selectedTrackId, setTrack]);

  if (!itemId) {
    return (
      <Card>
        <CardBody>
          <p className="text-fg-body-subtle text-sm">Релиз не выбран.</p>
          <Button onClick={openCollection} className="mt-4">
            К коллекции
          </Button>
        </CardBody>
      </Card>
    );
  }
  if (!item) {
    return (
      <Card>
        <CardBody>
          <p className="text-fg-body-subtle text-sm">Загружаю…</p>
        </CardBody>
      </Card>
    );
  }

  const activeTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;

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

  const onFetchLyrics = async () => {
    if (!activeTrack) return;
    setLyricsLoading(true);
    setLyricsError(null);
    try {
      const registry = new ProvidersRegistry({});
      const result = await registry.genius?.getLyrics(item.release.artist, activeTrack.title);
      if (result) {
        setLyricsDraft(result.text);
        setLyricsSource(result.source);
      } else {
        setLyricsError('Текст не найден. Введите вручную.');
      }
    } catch (e) {
      setLyricsError((e as Error).message);
    } finally {
      setLyricsLoading(false);
    }
  };

  const onSaveLyrics = () => {
    if (!activeTrack) return;
    setLyrics.mutate({
      trackId: activeTrack.id,
      lyrics: lyricsDraft,
      src: lyricsSource || 'manual',
    });
  };

  return (
    <section>
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-fg-heading">{item.release.title}</h2>
          <p className="text-fg-body-subtle text-sm">{item.release.artist}</p>
        </div>
        <Button variant="neutral" onClick={openCollection}>
          ← К коллекции
        </Button>
      </header>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="aspect-square w-full">
            <CoverImage
              releaseId={item.release.id}
              coverPath={item.release.coverPath}
              coverRemote={item.release.coverRemote}
              alt={item.release.title}
              size="full"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{typeLabels[item.type]}</Badge>
            {item.release.year ? <Badge>{item.release.year}</Badge> : null}
            {item.release.genres.slice(0, 2).map((g) => (
              <Badge key={g} tone="secondary">
                {g}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-fg-heading">Мои заметки</h3>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Где хранится"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Input
                  label="Состояние конверта"
                  placeholder="NM / VG+ / G…"
                  value={sleeveCondition}
                  onChange={(e) => setSleeveCondition(e.target.value)}
                />
                <Input
                  label="Состояние носителя"
                  placeholder="NM / VG+ / G…"
                  value={mediaCondition}
                  onChange={(e) => setMediaCondition(e.target.value)}
                />
              </div>
              <div className="mt-4">
                <Textarea
                  label="Заметки"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={onSaveMeta} disabled={updateItem.isPending}>
                  {updateItem.isPending ? 'Сохраняю…' : 'Сохранить'}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-fg-heading">Треклист</h3>
            </CardHeader>
            <CardBody>
              {tracks.length === 0 ? (
                <p className="text-fg-body-subtle text-sm">
                  Треклист не загружен. Это ручное добавление или провайдер не вернул треки.
                </p>
              ) : (
                <ol className="divide-border-default m-0 list-none divide-y p-0">
                  {tracks.map((t) => {
                    const active = t.id === selectedTrackId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setTrack(t.id)}
                          aria-pressed={active}
                          className={
                            'flex w-full items-center justify-between gap-4 px-3 py-3 text-left ' +
                            'border-0 bg-transparent transition-all duration-200' +
                            (active
                              ? 'shadow-neu-inset rounded-base'
                              : 'hover:shadow-neu-sm rounded-base')
                          }
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-fg-body-subtle w-8 text-xs">{t.position}</span>
                            <span className="text-fg-heading text-sm">{t.title}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {t.lyrics ? <Badge tone="brand">текст</Badge> : null}
                            {t.duration ? (
                              <span className="text-fg-body-subtle text-xs">
                                {formatDuration(t.duration)}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>

          {activeTrack ? (
            <Card>
              <CardHeader>
                <h3 className="text-fg-heading">Текст: {activeTrack.title}</h3>
              </CardHeader>
              <CardBody>
                {activeTrack.lyrics ? (
                  <pre className="text-fg-body whitespace-pre-wrap font-sans text-sm">
                    {activeTrack.lyrics}
                  </pre>
                ) : (
                  <p className="text-fg-body-subtle mb-4 text-sm">
                    Текста пока нет. Попробуйте найти автоматически или введите вручную.
                  </p>
                )}
                <div className="mt-4">
                  <Textarea
                    label="Текст песни"
                    placeholder="Введите текст вручную, либо нажмите «Найти» выше"
                    value={lyricsDraft}
                    onChange={(e) => setLyricsDraft(e.target.value)}
                    helperText={lyricsSource ? `Источник: ${lyricsSource}` : 'Ручной ввод'}
                    state={lyricsError ? 'error' : 'default'}
                  />
                </div>
                {lyricsError ? <p className="mt-2 text-sm text-[#d04545]">{lyricsError}</p> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="neutral" onClick={onFetchLyrics} disabled={lyricsLoading}>
                    {lyricsLoading ? 'Ищу…' : 'Найти'}
                  </Button>
                  <Button onClick={onSaveLyrics} disabled={!lyricsDraft || setLyrics.isPending}>
                    {setLyrics.isPending ? 'Сохраняю…' : 'Сохранить текст'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
