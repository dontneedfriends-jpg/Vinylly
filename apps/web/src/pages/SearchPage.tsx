import { useState } from 'react';
import { Card, CardBody, Input, Button, Badge } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { ProvidersRegistry, type SearchResult } from '@vinylly/media-providers';
import { CoverImage } from '../components/CoverImage';

export function SearchPage() {
  const initial = useUi((s) => s.search);
  const setUiSearch = useUi((s) => s.setSearch);
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = async () => {
    if (!query.trim()) return;
    setUiSearch(query);
    setSearching(true);
    setError(null);
    try {
      const registry = new ProvidersRegistry({});
      const r = await registry.searchAll({ text: query.trim() });
      setResults(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <section>
      <header className="mb-8">
        <h2 className="text-fg-heading">Поиск</h2>
        <p className="text-fg-body-subtle text-sm">
          Здесь можно посмотреть, что есть в источниках. Чтобы добавить в коллекцию — перейдите на
          вкладку «Добавить».
        </p>
      </header>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Название, артист, штрих-код"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSearch();
                }}
                aria-label="Поисковый запрос"
              />
            </div>
            <Button onClick={onSearch} disabled={searching || !query.trim()}>
              {searching ? 'Ищу…' : 'Найти'}
            </Button>
          </div>
          {error ? <p className="mt-3 text-sm text-[#d04545]">{error}</p> : null}
        </CardBody>
      </Card>

      {results.length > 0 ? (
        <ul className="mt-8 grid list-none grid-cols-2 gap-6 p-0 md:grid-cols-3 lg:grid-cols-4">
          {results.map((r, i) => (
            <li key={`${r.provider}-${r.release.sourceId}-${i}`}>
              <Card>
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
                        <span className="text-fg-body-subtle text-xs">{r.release.year}</span>
                      ) : null}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
