import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@vinylly/ui';
import { useSettings } from '../lib/settings-store';
import { getProvidersRegistry } from '../lib/providers';
import { getHostShell } from '@vinylly/host';
import { ExternalLink } from './ExternalLink';
import { collectionRepo, itemRepo, wantlistRepo } from '@vinylly/db';
import { ImportProgress } from './ImportProgress';

interface DiscogsPanelProps {
  /** True when this panel belongs to the active profile; controls/imports require it. */
  isActive: boolean;
}

export function DiscogsPanel({ isActive }: DiscogsPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const token = useSettings((s) => s.discogsToken);
  const username = useSettings((s) => s.discogsUsername);
  const syncEnabled = useSettings((s) => s.discogsSyncEnabled);
  const setUsername = useSettings((s) => s.setDiscogsUsername);
  const setSync = useSettings((s) => s.setDiscogsSyncEnabled);

  const [busy, setBusy] = useState<'test' | 'import' | 'importWantlist' | null>(null);
  const [testResult, setTestResult] = useState<{ kind: 'idle' | 'ok' | 'error'; message: string } | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importStatus, setImportStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; message: string } | null>(null);
  const importCounterRef = useRef(0);

  const hasToken = Boolean(token);

  const onTest = async () => {
    setBusy('test');
    setTestResult(null);
    try {
      const shell = getHostShell();
      const res = await shell
        .net()
        .fetchJson<{ username?: string }>('https://api.discogs.com/oauth/identity', {
          headers: { Authorization: `Discogs token=${token}` },
        });
      const who = res.username ?? '';
      if (who && who !== username) await setUsername(who);
      const whoSuffix = who ? ` (@${who})` : '';
      setTestResult({ kind: 'ok', message: t('settings:discogs.test_ok', { username: whoSuffix }) });
    } catch (err) {
      const msg = (err as Error).message ?? 'unknown error';
      setTestResult({
        kind: 'error',
        message: t('settings:discogs.test_fail', { error: msg }),
      });
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    if (!username) return;
    setBusy('import');
    setImportStatus(null);
    const importId = ++importCounterRef.current;
    try {
      const collection = await collectionRepo.ensureDefault();
      const registry = getProvidersRegistry();
      const releases = await registry.fetchDiscogsCollection(username);
      let imported = 0;
      let skipped = 0;
      setImportProgress({ done: 0, total: releases.length });
      const concurrency = 4;
      let cursor = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
          if (importId !== importCounterRef.current) return;
          const i = cursor++;
          const rel = releases[i];
          if (!rel) return;
          const exists = await itemRepo.findBySource('discogs', String(rel.discogsId));
          if (exists) {
            skipped++;
          } else {
            let tracklist:
              | Array<{ position: string; title: string; duration?: number | null }>
              | undefined;
            try {
              const detail = await registry.discogs?.getRelease(String(rel.discogsId));
              tracklist = detail?.tracklist;
            } catch {
              tracklist = undefined;
            }
            await itemRepo.create({
              collectionId: collection.id,
              type: rel.type,
              discogsInstanceId: rel.instanceId,
              release: {
                source: 'discogs',
                sourceId: String(rel.discogsId),
                title: rel.title,
                artist: rel.artist,
                year: rel.year,
                genres: rel.genres,
                styles: rel.styles,
                coverRemote: rel.coverUrl,
                thumbRemote: rel.thumbUrl,
              },
              ...(tracklist ? { tracklist } : {}),
            });
            imported++;
          }
          if (importId === importCounterRef.current) {
            setImportProgress({ done: imported + skipped, total: releases.length });
          }
        }
      });
      await Promise.all(workers);
      if (importId !== importCounterRef.current) return;
      await queryClient.invalidateQueries({ queryKey: ['items'] });
      setImportStatus({
        kind: 'ok',
        message: t('settings:discogs.import_success', {
          imported,
          skipped,
          total: releases.length,
        }),
      });
    } catch (err) {
      if (importId === importCounterRef.current) {
        setImportStatus({
          kind: 'error',
          message: t('settings:discogs.import_error', { error: String(err) }),
        });
      }
    } finally {
      if (importId === importCounterRef.current) {
        setBusy(null);
        setImportProgress(null);
      }
    }
  };

  const onImportWantlist = async () => {
    if (!username) return;
    setBusy('importWantlist');
    setImportStatus(null);
    const importId = ++importCounterRef.current;
    try {
      const registry = getProvidersRegistry();
      const wants = await registry.fetchDiscogsWantlist(username);
      let imported = 0;
      let skipped = 0;
      setImportProgress({ done: 0, total: wants.length });
      const concurrency = 4;
      let cursor = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
          if (importId !== importCounterRef.current) return;
          const i = cursor++;
          const rel = wants[i];
          if (!rel) return;
          const already = await wantlistRepo.contains('discogs', String(rel.discogsId));
          if (already) {
            skipped++;
          } else {
            await wantlistRepo.add({
              release: {
                source: 'discogs',
                sourceId: String(rel.discogsId),
                title: rel.title,
                artist: rel.artist,
                year: rel.year,
                masterId: rel.masterId,
                genres: rel.genres,
                styles: rel.styles,
                coverRemote: rel.coverUrl,
                thumbRemote: rel.thumbUrl,
              },
            });
            imported++;
          }
          if (importId === importCounterRef.current) {
            setImportProgress({ done: imported + skipped, total: wants.length });
          }
        }
      });
      await Promise.all(workers);
      if (importId !== importCounterRef.current) return;
      await queryClient.invalidateQueries({ queryKey: ['wantlist'] });
      setImportStatus({
        kind: 'ok',
        message: t('settings:discogs.wantlist_import_success', {
          imported,
          skipped,
          total: wants.length,
        }),
      });
    } catch (err) {
      if (importId === importCounterRef.current) {
        setImportStatus({
          kind: 'error',
          message: t('settings:discogs.import_error', { error: String(err) }),
        });
      }
    } finally {
      if (importId === importCounterRef.current) {
        setBusy(null);
        setImportProgress(null);
      }
    }
  };

  if (!hasToken) {
    return (
      <div className="space-y-3">
        <p className="text-fg-body-subtle text-xs">
          {t('settings:discogs.no_token_hint')}
        </p>
        <ExternalLink
          href="https://www.discogs.com/settings/developers"
          className="text-fg-brand inline-flex items-center gap-1 text-xs underline underline-offset-2 hover:text-fg-brand-strong"
        >
          {t('settings:discogs.instruction_link')}
        </ExternalLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Row label={t('settings:discogs.username_label')} value={username || '—'}>
        {!username ? (
          <Button size="sm" variant="neutral" onClick={onTest} disabled={busy === 'test'}>
            {t('settings:discogs.detect_button')}
          </Button>
        ) : null}
      </Row>
      {testResult ? (
        <div className={`text-xs ${testResult.kind === 'ok' ? 'text-fg-brand' : 'text-fg-danger'}`}>
          {testResult.message}
        </div>
      ) : null}

      <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex flex-col gap-3 border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-fg-heading text-sm font-medium">{t('settings:discogs.sync_label')}</div>
          <div className="text-fg-body-subtle text-xs">{t('settings:discogs.sync_desc')}</div>
        </div>
        <ToggleSwitch
          checked={syncEnabled}
          onChange={(v) => {
            void setSync(v);
          }}
          ariaLabel={t('settings:discogs.sync_label')}
        />
      </div>

      <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex flex-col gap-3 border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-fg-heading text-sm font-medium">{t('settings:discogs.import_label')}</div>
          <div className="text-fg-body-subtle text-xs">{t('settings:discogs.import_desc')}</div>
          {busy === 'import' && importProgress ? (
            <ImportProgress done={importProgress.done} total={importProgress.total} className="mt-2" />
          ) : null}
        </div>
        <Button
          size="sm"
          variant="neutral"
          disabled={busy === 'import' || !username || !isActive}
          onClick={() => void onImport()}
          leftIcon={busy === 'import' ? undefined : <DownloadIcon />}
          className="self-start sm:self-auto"
        >
          {busy === 'import' ? t('common:loading.generic') : t('settings:discogs.import_button')}
        </Button>
      </div>

      <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex flex-col gap-3 border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-fg-heading text-sm font-medium">{t('settings:discogs.wantlist_import_label')}</div>
          <div className="text-fg-body-subtle text-xs">{t('settings:discogs.wantlist_import_desc')}</div>
          {busy === 'importWantlist' && importProgress ? (
            <ImportProgress done={importProgress.done} total={importProgress.total} className="mt-2" />
          ) : null}
        </div>
        <Button
          size="sm"
          variant="neutral"
          disabled={busy === 'importWantlist' || !username || !isActive}
          onClick={() => void onImportWantlist()}
          leftIcon={busy === 'importWantlist' ? undefined : <DownloadIcon />}
          className="self-start sm:self-auto"
        >
          {busy === 'importWantlist' ? t('common:loading.generic') : t('settings:discogs.wantlist_import_button')}
        </Button>
      </div>

      {importStatus ? (
        <div className={`text-xs ${importStatus.kind === 'ok' ? 'text-fg-brand' : 'text-fg-danger'}`}>
          {importStatus.message}
        </div>
      ) : null}

      {!isActive ? (
        <p className="text-fg-body-subtle text-xs">{t('profile:settings.activate_first')}</p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  children,
  value,
}: {
  label: string;
  children: React.ReactNode;
  value?: string;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-6">
      <div className="min-w-0">
        <div className="text-fg-body-subtle text-xs">{label}</div>
        {value ? <div className="text-fg-heading mt-0.5 break-all text-sm">{value}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-neu ${
        checked
          ? 'bg-surface border-border-default-medium text-fg-brand-strong shadow-neu-inset'
          : 'bg-surface border-border-default shadow-neu-xs'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 translate-y-0 rounded-full border bg-white shadow-sm transition-neu ${
          checked ? 'translate-x-4 border-border-default-medium' : 'translate-x-0.5 border-border-default'
        }`}
      />
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 4v12m-5-5 5 5 5-5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
