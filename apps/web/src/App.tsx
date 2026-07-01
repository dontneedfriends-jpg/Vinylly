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
    <>
      <KeyboardShortcuts />
      <Layout>
        {page === 'collection' ? <CollectionPage /> : null}
        {page === 'add' ? <AddPage /> : null}
        {page === 'detail' ? <DetailPage /> : null}
        {page === 'settings' ? <SettingsPage /> : null}
        <Toast />
      </Layout>
    </>
  );
}

function KeyboardShortcuts() {
  const page = useUi((s) => s.page);
  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const openSettings = useUi((s) => s.openSettings);
  const showToast = useUi((s) => s.showToast);
  const hideToast = useUi((s) => s.hideToast);
  const toast = useUi((s) => s.toast);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '1':
          openCollection();
          break;
        case '2':
          openAdd();
          break;
        case '3':
          openSettings();
          break;
        case '?': {
          e.preventDefault();
          if (toast) { hideToast(); return; }
          showToast('1 Коллекция · 2 Добавить · 3 Настройки · / Поиск · ? Помощь');
          break;
        }
        case '/': {
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>('[data-search-input]');
          if (input) { input.focus(); input.select(); }
          break;
        }
        case 'Escape':
          hideToast();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, openCollection, openAdd, openSettings, showToast, hideToast, toast]);

  return null;
}

function Toast() {
  const { t } = useTranslation();
  const toast = useUi((s) => s.toast);
  const hideToast = useUi((s) => s.hideToast);

  useEffect(() => {
    if (!toast || !toast.duration) return;
    const timer = setTimeout(hideToast, toast.duration);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise">
      <div className="rounded-base border-border-default bg-surface shadow-neu-lg flex items-center gap-4 border px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
        <span className="text-fg-body text-sm">{toast.message}</span>
        {toast.action ? (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="text-fg-brand-strong hover:text-fg-heading rounded-sm px-2 py-1 text-sm font-semibold transition-colors"
          >
            {toast.action.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={hideToast}
          className="text-fg-body-subtle hover:text-fg-heading rounded-sm p-1 transition-colors"
          aria-label={t('common:button.cancel')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
