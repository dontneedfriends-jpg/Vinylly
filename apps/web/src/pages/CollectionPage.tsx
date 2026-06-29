import { useMemo, useState } from 'react';
import { Card, CardBody, Badge, Input } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useItems } from '../lib/queries';
import type { MediaType, ItemRecord } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';

const typeLabels: Record<MediaType, string> = {
  vinyl: 'Винил',
  cd: 'CD',
  cassette: 'Кассета',
  other: 'Другое',
};

const typeFilterValues: Array<'all' | MediaType> = ['all', 'vinyl', 'cd', 'cassette', 'other'];

const sortValues: Array<{
  id: 'addedDesc' | 'addedAsc' | 'titleAsc' | 'artistAsc' | 'yearDesc';
  label: string;
}> = [
  { id: 'addedDesc', label: 'Сначала новые' },
  { id: 'addedAsc', label: 'Сначала старые' },
  { id: 'titleAsc', label: 'По названию' },
  { id: 'artistAsc', label: 'По артисту' },
  { id: 'yearDesc', label: 'По году (новые)' },
];

export function CollectionPage() {
  const search = useUi((s) => s.search);
  const filterType = useUi((s) => s.filterType);
  const sort = useUi((s) => s.sort);
  const setSearch = useUi((s) => s.setSearch);
  const setFilterType = useUi((s) => s.setFilterType);
  const setSort = useUi((s) => s.setSort);
  const openDetail = useUi((s) => s.openDetail);

  const [localSearch, setLocalSearch] = useState(search);

  const filter = useMemo(
    () => ({
      type: filterType === 'all' ? undefined : filterType,
      search: search || undefined,
      sort,
    }),
    [filterType, search, sort],
  );

  const { data: items = [], isLoading } = useItems(filter);

  return (
    <section>
      <header className="mb-8">
        <h2 className="text-fg-heading">Коллекция</h2>
        <p className="text-fg-body-subtle text-sm">
          {items.length === 0 && !isLoading
            ? 'Пока пусто. Добавьте первый релиз.'
            : `Релизов в коллекции: ${items.length}`}
        </p>
      </header>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Input
          label="Поиск"
          placeholder="Название или артист"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch(localSearch);
          }}
        />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-fg-heading mb-2 block text-sm font-medium">Тип</label>
            <div className="flex flex-wrap gap-2">
              {typeFilterValues.map((v) => {
                const active = v === filterType;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFilterType(v)}
                    aria-pressed={active}
                    className={
                      'rounded-base border px-3 py-1.5 text-sm transition-all duration-200 ease-in-out ' +
                      (active
                        ? 'bg-surface border-border-default text-fg-heading shadow-neu-inset'
                        : 'bg-surface border-border-default text-fg-body shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset')
                    }
                  >
                    {v === 'all' ? 'Все' : typeLabels[v]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="sort" className="text-fg-heading mb-2 block text-sm font-medium">
              Сортировка
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="bg-surface border-border-default rounded-base shadow-neu-inset text-fg-heading focus:ring-fg-brand/50 w-full border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            >
              {sortValues.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-fg-body-subtle text-sm">Загружаем…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-fg-body-subtle text-sm">
              По заданным фильтрам ничего не найдено. Попробуйте сбросить фильтры или перейдите на
              вкладку «Добавить», чтобы пополнить коллекцию.
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="grid list-none grid-cols-2 gap-6 p-0 md:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <li key={it.id}>
              <ItemTile item={it} onOpen={() => openDetail(it.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemTile({ item, onOpen }: { item: ItemRecord; onOpen: () => void }) {
  return (
    <Card variant="interactive" as="button" onClick={onOpen} className="w-full text-left">
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="aspect-square">
            <CoverImage
              releaseId={item.release.id}
              coverPath={item.release.coverPath}
              coverRemote={item.release.coverRemote}
              alt={`Обложка ${item.release.title}`}
              size="thumb"
            />
          </div>
          <div>
            <div className="text-fg-heading line-clamp-2 text-sm font-semibold">
              {item.release.title}
            </div>
            <div className="text-fg-body-subtle line-clamp-1 text-xs">{item.release.artist}</div>
          </div>
          <div className="flex items-center justify-between">
            <Badge tone="brand">{typeLabels[item.type]}</Badge>
            {item.release.year ? (
              <span className="text-fg-body-subtle text-xs">{item.release.year}</span>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
