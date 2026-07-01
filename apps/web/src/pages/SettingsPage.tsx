import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  Input,
  SegmentedControl,
  PageHeader,
} from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { itemRepo, trackRepo } from '../lib/db';
import { useDefaultCollection, useItems } from '../lib/queries';
import {
  buildBundle,
  bundleToCsv,
  bundleToJson,
  downloadFile,
  parseBundle,
  readFileText,
} from '../lib/import-export';
import { useSettings } from '../lib/settings-store';
import { useLocale } from '../lib/locale-store';
import { resetProvidersRegistry } from '../lib/providers';
import { getHostShell } from '@vinylly/host';
import { ExternalLink } from '../components/ExternalLink';
import type { CreateItemInput, TrackRecord } from '@vinylly/db';

type Status = { kind: 'idle' | 'ok' | 'error'; message: string };

export function SettingsPage() {
  const { t } = useTranslation();
  const openCollection = useUi((s) => s.openCollection);
  const { data: collection } = useDefaultCollection();
  const { data: items = [] } = useItems({});
  const discogsToken = useSettings((s) => s.discogsToken);
  const setDiscogsToken = useSettings((s) => s.setDiscogsToken);
  const clearDiscogsToken = useSettings((s) => s.clearDiscogsToken);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [busy, setBusy] = useState(false);

  const onExportJson = async () => {
    const tracksByRelease = await loadAllTracks(items.map((it) => it.release.id));
    const bundle = buildBundle(items, tracksByRelease);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`vinylly-${date}.json`, bundleToJson(bundle), 'application/json');
    setStatus({ kind: 'ok', message: t('settings:export.done', { count: items.length }) });
  };

  const onExportCsv = async () => {
    const tracksByRelease = await loadAllTracks(items.map((it) => it.release.id));
    const bundle = buildBundle(items, tracksByRelease);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`vinylly-${date}.csv`, bundleToCsv(bundle), 'text/csv;charset=utf-8');
    setStatus({ kind: 'ok', message: t('settings:export.done', { count: items.length }) });
  };

  const onImport = async (file: File) => {
    if (!collection) return;
    setBusy(true);
    try {
      const raw = await readFileText(file);
      const bundle = parseBundle(raw);
      let added = 0;
      for (const it of bundle.items) {
        const input: CreateItemInput = {
          collectionId: collection.id,
          type: it.type,
          release: {
            source: it.release.source,
            sourceId: it.release.sourceId,
            title: it.release.title,
            artist: it.release.artist,
            year: it.release.year,
            genres: it.release.genres,
            styles: it.release.styles,
            coverPath: it.release.coverPath,
            thumbPath: it.release.thumbPath,
            coverRemote: it.release.coverRemote,
            thumbRemote: it.release.thumbRemote,
          },
          tracklist: it.tracklist.map((tr) => ({
            position: tr.position,
            title: tr.title,
            duration: tr.duration,
          })),
          notes: it.notes,
          location: it.location,
          tags: it.tags,
          acquiredAt: it.acquiredAt,
          barcode: it.barcode,
          catalogNumber: it.catalogNumber,
          sleeveCondition: it.sleeveCondition,
          mediaCondition: it.mediaCondition,
        };
        await itemRepo.create(input);
        added += 1;
      }
      setStatus({ kind: 'ok', message: t('settings:import.done', { count: added }) });
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="animate-rise">
      <PageHeader
        title={t('settings:page.title')}
        subtitle={t('settings:page.subtitle')}
        actions={
          <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />}>
            {t('settings:page.to_collection')}
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <LanguageCard />

        <BackupCard onStatus={setStatus} />

        <DiscogsCard token={discogsToken} onSave={setDiscogsToken} onClear={clearDiscogsToken} />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-6 pt-8">
              <div className="flex items-start gap-5">
                <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
                  <ExportIcon />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-fg-heading text-base font-semibold leading-tight">{t('settings:export.title')}</h3>
                  <p className="text-fg-body-subtle mt-2 text-xs leading-snug">
                    {t('settings:export.description')}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="px-12 py-6">
              <p className="text-fg-body-subtle text-[15px] leading-relaxed">
                {t('settings:export.collection_count', { count: items.length })}
              </p>
            </CardBody>
            <CardFooter className="pb-8 pt-5">
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <Button variant="neutral" onClick={onExportCsv} disabled={items.length === 0}>
                  {t('settings:export.csv')}
                </Button>
                <Button onClick={onExportJson} disabled={items.length === 0}>
                  {t('settings:export.json')}
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-6 pt-8">
              <div className="flex items-start gap-5">
                <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
                  <ImportIcon />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-fg-heading text-base font-semibold leading-tight">{t('settings:import.title')}</h3>
                  <p className="text-fg-body-subtle mt-2 text-xs leading-snug">
                    {t('settings:import.description')}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="px-12 py-6">
              <p className="text-fg-body-subtle text-[15px] leading-relaxed">
                {t('settings:import.body')}
              </p>
              {busy ? <p className="text-fg-body-subtle mt-3 text-sm">{t('settings:import.progress')}</p> : null}
            </CardBody>
            <CardFooter className="pb-8 pt-5">
              <div className="ml-auto">
                <label className="border-border-default bg-surface text-fg-heading rounded-base shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset inline-flex cursor-pointer items-center gap-2.5 border px-5 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out">
                  <UploadIcon />
                  <span>{t('settings:import.button')}</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onImport(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {status.kind !== 'idle' ? (
        <div className="mt-6">
          <Alert tone={status.kind === 'error' ? 'danger' : 'success'}>{status.message}</Alert>
        </div>
      ) : null}
    </section>
  );
}

function LanguageCard() {
  const { t } = useTranslation();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);

  return (
    <Card>
      <CardHeader className="pb-6 pt-8">
        <div className="flex items-start gap-5">
          <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
            <GlobeIcon />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-fg-heading text-base font-semibold leading-tight">{t('settings:language.title')}</h3>
          </div>
        </div>
      </CardHeader>
      <CardBody className="px-12 py-6">
        <SegmentedControl
          value={locale}
          onChange={(v) => setLocale(v)}
          options={[
            { value: 'ru', label: t('settings:language.ru') },
            { value: 'en', label: t('settings:language.en') },
          ]}
          size="sm"
        />
      </CardBody>
    </Card>
  );
}

function BackupCard({ onStatus }: { onStatus: (s: Status) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const onBackup = async () => {
    setBusy(true);
    try {
      const shell = getHostShell();
      const dbPath = shell.paths().dataDir + '/vinylly.sqlite';
      const bytes = await shell.fs().readBinary(dbPath);
      const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
      const filename = `vinylly-backup-${date}.sqlite`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      onStatus({ kind: 'ok', message: t('settings:backup.done', { filename }) });
    } catch (e) {
      onStatus({ kind: 'error', message: t('settings:backup.error', { error: (e as Error).message }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-6 pt-8">
        <div className="flex items-start gap-5">
          <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
            <ShieldIcon />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-fg-heading text-base font-semibold leading-tight">{t('settings:backup.title')}</h3>
            <p className="text-fg-body-subtle mt-2 text-xs leading-snug">
              {t('settings:backup.description')}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="px-12 py-6">
        <p className="text-fg-body-subtle text-[15px] leading-relaxed">{t('settings:export.collection_count', { count: 0 })}</p>
      </CardBody>
      <CardFooter className="pb-8 pt-5">
        <div className="ml-auto">
          <Button onClick={onBackup} disabled={busy} leftIcon={busy ? undefined : <DownloadIcon />}>
            {busy ? t('common:loading.generic') : t('settings:backup.button')}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

interface DiscogsCardProps {
  token: string;
  onSave(token: string): Promise<void>;
  onClear(): Promise<void>;
}

function DiscogsCard({ token, onSave, onClear }: DiscogsCardProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [testResult, setTestResult] = useState<Status | null>(null);
  const [busy, setBusy] = useState<'save' | 'clear' | 'test' | null>(null);

  const hasToken = Boolean(token);
  const dirty = draft.trim() !== '' && draft.trim() !== token;

  const displayValue = revealed && !dirty && hasToken ? token : draft;
  const inputType = !hasToken ? 'password' : revealed && !dirty ? 'text' : 'password';

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = draft.trim();
    if (!next) {
      setStatus({ kind: 'error', message: t('settings:discogs.error_empty') });
      return;
    }
    setBusy('save');
    setStatus({ kind: 'idle', message: '' });
    setTestResult(null);
    try {
      await onSave(next);
      resetProvidersRegistry();
      setDraft('');
      setRevealed(false);
      setStatus({ kind: 'ok', message: t('settings:discogs.saved_ok') });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onClearClick = async () => {
    setBusy('clear');
    setStatus({ kind: 'idle', message: '' });
    setTestResult(null);
    try {
      await onClear();
      resetProvidersRegistry();
      setDraft('');
      setRevealed(false);
      setConfirmingDelete(false);
      setStatus({ kind: 'ok', message: t('settings:discogs.cleared_ok') });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onTest = async () => {
    setBusy('test');
    setTestResult(null);
    setStatus({ kind: 'idle', message: '' });
    try {
      const shell = getHostShell();
      const res = await shell
        .net()
        .fetchJson<{ username?: string }>('https://api.discogs.com/oauth/identity', {
          headers: { Authorization: `Discogs token=${token}` },
        });
      const who = res.username ? ` (@${res.username})` : '';
      setTestResult({ kind: 'ok', message: t('settings:discogs.test_ok', { username: who }) });
    } catch (err) {
      const msg = (err as Error).message ?? 'неизвестная ошибка';
      setTestResult({
        kind: 'error',
        message: t('settings:discogs.test_fail', { error: msg }),
      });
    } finally {
      setBusy(null);
    }
  };

  const toggleReveal = () => {
    if (!hasToken) return;
    if (revealed) {
      setRevealed(false);
      setDraft('');
    } else {
      setRevealed(true);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-6 pt-8">
        <div className="flex items-start gap-5">
          <div className="rounded-base bg-brand-softer border-border-brand-subtle flex h-12 w-12 shrink-0 items-center justify-center border">
            <VinylIcon />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-fg-heading text-lg font-semibold leading-tight">{t('settings:discogs.title')}</h3>
            <p className="text-fg-body-subtle mt-2 text-sm leading-snug">
              {t('settings:discogs.description')}
            </p>
          </div>
            <Badge tone={hasToken ? 'success' : 'warning'} pill>
            {hasToken ? t('settings:discogs.configured') : t('settings:discogs.missing')}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-8 px-12 py-6">
        <p className="text-fg-body text-[15px] leading-relaxed">
          {t('settings:discogs.intro')}{' '}
          <ExternalLink
            href="https://www.discogs.com/settings/developers"
            className="text-fg-brand-strong hover:text-fg-heading decoration-border-brand font-medium underline decoration-1 underline-offset-4 transition-colors"
          >
            Personal Access Token
          </ExternalLink>
          .{' '}
          <ExternalLink
            href="https://www.discogs.com/settings/developers"
            className="text-fg-body-subtle hover:text-fg-heading inline-flex items-center gap-1 transition-colors"
          >
            {t('settings:discogs.instruction_link')}
            <ArrowUpRightIcon />
          </ExternalLink>
        </p>

        <form onSubmit={onSubmit} className="space-y-6">
          <Input
            label={t('settings:discogs.token_label')}
            type={inputType}
            value={displayValue}
            onChange={(e) => {
              setDraft(e.target.value);
              if (revealed && !hasToken) setRevealed(false);
            }}
            placeholder={
              hasToken
                ? revealed
                  ? t('settings:discogs.placeholder_configured_revealed')
                  : t('settings:discogs.placeholder_configured_hidden')
                : t('settings:discogs.placeholder_empty')
            }
            autoComplete="off"
            spellCheck={false}
            leftIcon={<KeyIcon />}
            rightIcon={
              hasToken ? (
                <button
                  type="button"
                  onClick={toggleReveal}
                  aria-label={revealed ? t('settings:discogs.hide_aria') : t('settings:discogs.show_aria')}
                  className="text-fg-body hover:text-fg-heading pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded transition-colors"
                >
                  {revealed ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              ) : null
            }
            helperText={
              hasToken
                ? revealed
                  ? t('settings:discogs.helper_revealed')
                  : t('settings:discogs.helper_configured')
                : t('settings:discogs.helper_empty')
            }
          />

          {hasToken && confirmingDelete ? (
            <div className="rounded-base border-border-danger-subtle bg-danger-soft animate-rise flex flex-wrap items-center gap-5 px-6 py-5">
              <AlertIcon className="text-fg-danger-strong h-5 w-5 shrink-0" />
              <span className="text-fg-body text-[15px] leading-relaxed">
                {t('settings:discogs.delete_confirm')}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy === 'clear'}
                >
                  {t('common:button.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={onClearClick}
                  disabled={busy === 'clear'}
                >
                  {busy === 'clear' ? t('settings:discogs.delete_progress') : t('settings:discogs.delete_yes')}
                </Button>
              </div>
            </div>
          ) : null}

          {status.kind !== 'idle' ? (
            <Alert tone={status.kind === 'error' ? 'danger' : 'success'}>{status.message}</Alert>
          ) : null}

          {testResult ? (
            <Alert tone={testResult.kind === 'error' ? 'danger' : 'success'}>
              {testResult.message}
            </Alert>
          ) : null}
        </form>
      </CardBody>
      <CardFooter className="pb-8 pt-5">
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {hasToken && !confirmingDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy !== null}
            >
              {t('settings:discogs.delete_button')}
            </Button>
          ) : null}
          {hasToken ? (
            <Button
              type="button"
              variant="neutral"
              onClick={onTest}
              disabled={busy !== null}
              leftIcon={busy === 'test' ? undefined : <BoltIcon />}
            >
              {busy === 'test' ? t('settings:discogs.test_progress') : t('settings:discogs.test_button')}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onSubmit}
            leftIcon={busy === 'save' ? undefined : <CheckIcon />}
            disabled={!dirty || busy !== null}
          >
            {busy === 'save' ? t('settings:discogs.save_progress') : hasToken ? t('settings:discogs.save_change') : t('settings:discogs.save_new')}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

type AlertTone = 'success' | 'danger' | 'warning' | 'brand';

function Alert({ tone, children }: { tone: AlertTone; children: React.ReactNode }) {
  const toneClasses: Record<AlertTone, string> = {
    success: 'bg-success-soft text-fg-success-strong border-border-success-subtle',
    danger: 'bg-danger-soft text-fg-danger-strong border-border-danger-subtle',
    warning: 'bg-warning-soft text-fg-warning border-border-default',
    brand: 'bg-brand-softer text-fg-brand-strong border-border-brand-subtle',
  };
  const iconClasses: Record<AlertTone, string> = {
    success: 'text-fg-success-strong',
    danger: 'text-fg-danger-strong',
    warning: 'text-fg-warning',
    brand: 'text-fg-brand-strong',
  };
  return (
    <div
      role="status"
      className={`rounded-base animate-rise flex items-start gap-4 border px-6 py-5 text-[15px] leading-relaxed ${toneClasses[tone]}`}
    >
      <span className={`mt-0.5 shrink-0 ${iconClasses[tone]}`}>
        {tone === 'success' ? (
          <CheckIcon />
        ) : tone === 'danger' ? (
          <AlertIcon />
        ) : tone === 'warning' ? (
          <AlertIcon />
        ) : (
          <InfoIcon />
        )}
      </span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

async function loadAllTracks(releaseIds: string[]): Promise<Map<string, TrackRecord[]>> {
  const out = new Map<string, TrackRecord[]>();
  for (const id of releaseIds) {
    const tracks = await trackRepo.listByRelease(id);
    out.set(id, tracks);
  }
  return out;
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VinylIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-fg-brand-strong h-6 w-6"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L19 4M15 8l3 3M18 5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        d="M3 3l18 18M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.6 17.6 0 0 1-3.2 4M6.6 6.6A17.7 17.7 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.2 3.9-.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 16V4M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-5 w-5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinejoin="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-fg-body-subtle h-5 w-5"
      aria-hidden
    >
      <path d="M12 4v12M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-fg-body-subtle h-5 w-5" aria-hidden>
      <path d="M12 2l7 4v5c0 4-3 7.7-7 9-4-1.3-7-5-7-9V6l7-4z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 16V4M6 10l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-fg-body-subtle h-5 w-5"
      aria-hidden
    >
      <path d="M12 16V4M8 12l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}
