import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { CollectionPage } from './pages/CollectionPage';
import { AddPage } from './pages/AddPage';
import { DetailPage } from './pages/DetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { useUi } from './lib/ui-store';
import { useVinylDbInit } from './lib/db';
import { initSettings, useSettings } from './lib/settings-store';
import {
  createTauriHostShell,
  createWebHostShell,
  isTauriEnvironment,
  setHostShell,
  tryGetHostShell,
} from '@vinylly/host';

export function App() {
  const { t } = useTranslation();
  const page = useUi((s) => s.page);
  const ready = useVinylDbInit();
  const [settingsReady, setSettingsReady] = useState(false);
  const discogsToken = useSettings((s) => s.discogsToken);
  const onboardingDone = useSettings((s) => s.onboardingDone);

  useEffect(() => {
    if (tryGetHostShell()) {
      void initSettings().then(() => setSettingsReady(true));
      return;
    }
    if (isTauriEnvironment()) {
      void createTauriHostShell().then((shell) => {
        setHostShell(shell);
        void initSettings().then(() => setSettingsReady(true));
      });
    } else {
      setHostShell(createWebHostShell());
      void initSettings().then(() => setSettingsReady(true));
    }
  }, []);

  if (!ready) {
    return (
      <div className="bg-surface text-fg-body flex min-h-full items-center justify-center">
        <p className="text-fg-body-subtle text-sm">{t('common:loading.db')}</p>
      </div>
    );
  }

  if (settingsReady && !onboardingDone && !discogsToken) {
    return <Onboarding />;
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
