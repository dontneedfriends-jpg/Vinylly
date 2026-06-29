import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { CollectionPage } from './pages/CollectionPage';
import { AddPage } from './pages/AddPage';
import { SearchPage } from './pages/SearchPage';
import { DetailPage } from './pages/DetailPage';
import { useUi } from './lib/ui-store';
import { useVinylDbInit } from './lib/db';
import { createWebHostShell, setHostShell } from '@vinylly/host';

export function App() {
  const page = useUi((s) => s.page);
  const ready = useVinylDbInit();

  useEffect(() => {
    setHostShell(createWebHostShell());
  }, []);

  if (!ready) {
    return (
      <div className="bg-surface text-fg-body flex min-h-full items-center justify-center">
        <p className="text-fg-body-subtle text-sm">Готовлю базу…</p>
      </div>
    );
  }

  return (
    <Layout>
      {page === 'collection' ? <CollectionPage /> : null}
      {page === 'add' ? <AddPage /> : null}
      {page === 'search' ? <SearchPage /> : null}
      {page === 'detail' ? <DetailPage /> : null}
    </Layout>
  );
}
