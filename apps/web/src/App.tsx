import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { CollectionPage } from './pages/CollectionPage';
import { ReleasePreviewPage } from './pages/ReleasePreviewPage';
import { AddPage } from './pages/AddPage';
import { DetailPage } from './pages/DetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { WantlistPage } from './pages/WantlistPage';
import { ArtistPage } from './pages/ArtistPage';
import { useUi } from './lib/ui-store';
import { useVinylDbInit, switchActiveProfile } from './lib/db';
import { initSettings, useSettings } from './lib/settings-store';
import { initProfiles, useProfileStore } from './lib/profile-store';
import { tryGetHostShell, setHostShell, isTauriEnvironment } from '@vinylly/host';

export function App() {
  const { t } = useTranslation();
  useQueryClient();
  const page = useUi((s) => s.page);
  const releasePreviewId = useUi((s) => s.releasePreviewId);
  const ready = useVinylDbInit();
  const [bootDone, setBootDone] = useState(false);
  const onboardingDone = useSettings((s) => s.onboardingDone);
  const settingsReady = useSettings((s) => s.ready);
  const activeProfileId = useProfileStore((s) => s.activeId);
  const profilesReady = useProfileStore((s) => s.ready);

  // Bootstrap order:
  //   1. Profiles index (reads/migrates Tauri data or localStorage)
  //   2. Profile DB client (also constructs the host-shell for the active profile)
  //   3. Per-profile settings (Discogs token etc.)
  useEffect(() => {
    console.warn('[bootstrap] effect start');
    let cancelled = false;
    (async () => {
      try {
        console.warn('[bootstrap] initProfiles');
        const { activeId } = await initProfiles();
        console.warn('[bootstrap] initProfiles done', { activeId, cancelled });
        if (cancelled) return;
        if (activeId) {
          if (!tryGetHostShell()) {
            if (isTauriEnvironment()) {
              try {
                console.warn('[bootstrap] createTauriHostShell');
                const { createTauriHostShell } = await import('@vinylly/host');
                const shell = await createTauriHostShell(activeId);
                console.warn('[bootstrap] tauri shell built');
                if (!cancelled) setHostShell(shell);
              } catch (err) {
                console.warn('[bootstrap] tauri shell failed, falling back to web shell', err);
                const { createWebHostShell } = await import('@vinylly/host');
                if (!cancelled) setHostShell(createWebHostShell(activeId));
              }
            } else {
              // Web fallback — host shell carries profile-scoped paths.
              const { createWebHostShell } = await import('@vinylly/host');
              if (!cancelled) setHostShell(createWebHostShell(activeId));
            }
          }
          if (!cancelled) {
            console.warn('[bootstrap] switchActiveProfile');
            await switchActiveProfile(activeId);
            console.warn('[bootstrap] initSettings');
            await initSettings();
            console.warn('[bootstrap] initSettings done');
          }
        }
        if (!cancelled) {
          console.warn('[bootstrap] setBootDone(true)');
          setBootDone(true);
        }
      } catch (err) {
        console.error('[bootstrap] failed', err);
        if (!cancelled) setBootDone(true);
      }
    })();
    return () => {
      console.warn('[bootstrap] effect cleanup');
      cancelled = true;
    };
  }, []);

  // When the active profile changes (user switched via UI), reload the DB
  // client and per-profile settings so queries refetch against the new store.
  const qc = useQueryClient();
  useEffect(() => {
    if (!bootDone || !activeProfileId) return;
    let cancelled = false;
    (async () => {
      await switchActiveProfile(activeProfileId);
      await useSettings.getState().reload();
      if (!cancelled) qc.invalidateQueries();
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, bootDone, qc]);

  if (!ready || !bootDone || !profilesReady || !settingsReady) {
    return (
      <div className="bg-surface text-fg-body flex min-h-full items-center justify-center">
        <p className="text-fg-body-subtle text-sm">{t('common:loading.db')}</p>
      </div>
    );
  }

  if (!onboardingDone) {
    return <Onboarding />;
  }

  return (
    <>
      <KeyboardShortcuts />
      <Layout>
        {page === 'collection' ? <CollectionPage /> : null}
        {page === 'add' ? <AddPage /> : null}
        {page === 'detail' ? (releasePreviewId ? <ReleasePreviewPage /> : <DetailPage />) : null}
        {page === 'settings' ? <SettingsPage /> : null}
        {page === 'stats' ? <StatsPage /> : null}
        {page === 'wantlist' ? <WantlistPage /> : null}
        {page === 'artist' ? <ArtistPage /> : null}
        <Toast />
      </Layout>
    </>
  );
}

function KeyboardShortcuts() {
  const { t } = useTranslation();
  const page = useUi((s) => s.page);
  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const openSettings = useUi((s) => s.openSettings);
  const openWantlist = useUi((s) => s.openWantlist);
  const openStats = useUi((s) => s.openStats);
  const showToast = useUi((s) => s.showToast);
  const hideToast = useUi((s) => s.hideToast);
  const toast = useUi((s) => s.toast);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Don't fire shortcuts when modifier keys are held (Ctrl/Cmd/Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case '1':
          openCollection();
          break;
        case '2':
          openAdd();
          break;
        case '3':
          openWantlist();
          break;
        case '4':
          openStats();
          break;
        case '5':
          openSettings();
          break;
        case '?': {
          e.preventDefault();
          if (toast) { hideToast(); return; }
          showToast(t('common:shortcuts.help'));
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
  }, [page, openCollection, openAdd, openSettings, openWantlist, openStats, showToast, hideToast, toast, t]);

  return null;
}

function Toast() {
  const { t } = useTranslation();
  const toast = useUi((s) => s.toast);
  const hideToast = useUi((s) => s.hideToast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(0);
  const endsAtRef = useRef(0);

  // Auto-dismiss with pause-on-hover/focus (WCAG 2.2.1 — user must be able
  // to extend the time limit on transient messages).
  useEffect(() => {
    if (!toast || !toast.duration) return;
    remainingRef.current = toast.duration;
    endsAtRef.current = Date.now() + toast.duration;
    timerRef.current = setTimeout(hideToast, toast.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [toast, hideToast]);

  const pause = () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    remainingRef.current = Math.max(endsAtRef.current - Date.now(), 0);
  };
  const resume = () => {
    if (timerRef.current || !toast?.duration) return;
    const wait = Math.max(remainingRef.current, 500);
    endsAtRef.current = Date.now() + wait;
    timerRef.current = setTimeout(hideToast, wait);
  };

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className="rounded-base border-border-default bg-surface shadow-neu-lg flex items-center gap-4 border px-5 py-3">
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
          aria-label={t('common:button.dismiss')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
