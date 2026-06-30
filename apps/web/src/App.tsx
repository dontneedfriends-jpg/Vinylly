import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { CollectionPage } from './pages/CollectionPage';
import { AddPage } from './pages/AddPage';
import { DetailPage } from './pages/DetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { useUi } from './lib/ui-store';
import { useVinylDbInit } from './lib/db';
import { initSettings } from './lib/settings-store';
import {
  createTauriHostShell,
  createWebHostShell,
  isTauriEnvironment,
  setHostShell,
  tryGetHostShell,
} from '@vinylly/host';

export function App() {
  const page = useUi((s) => s.page);
  const ready = useVinylDbInit();

  useEffect(() => {
    if (tryGetHostShell()) {
      void initSettings();
      return;
    }
    if (isTauriEnvironment()) {
      void createTauriHostShell().then((shell) => {
        setHostShell(shell);
        void initSettings();
      });
    } else {
      setHostShell(createWebHostShell());
      void initSettings();
    }
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
      {page === 'detail' ? <DetailPage /> : null}
      {page === 'settings' ? <SettingsPage /> : null}
    </Layout>
  );
}
