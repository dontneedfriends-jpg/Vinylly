import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SegmentedControl } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useSettings } from '../lib/settings-store';
import { useLocale } from '../lib/locale-store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { getAppInfo, type AppInfo } from '../lib/app-info';
import { getProvidersRegistry, resetProvidersRegistry } from '../lib/providers';
import { getHostShell } from '@vinylly/host';
import { ExternalLink } from '../components/ExternalLink';
import { serializeDb, restoreFromJsonFile } from '../lib/db';
import { itemRepo, collectionRepo, wantlistRepo } from '@vinylly/db';

export function SettingsPage() {
  const { t } = useTranslation();
  const openCollection = useUi((s) => s.openCollection);
  const discogsToken = useSettings((s) => s.discogsToken);
  const discogsUsername = useSettings((s) => s.discogsUsername);
  const discogsSyncEnabled = useSettings((s) => s.discogsSyncEnabled);
  const setDiscogsToken = useSettings((s) => s.setDiscogsToken);
  const setDiscogsUsername = useSettings((s) => s.setDiscogsUsername);
  const setDiscogsSyncEnabled = useSettings((s) => s.setDiscogsSyncEnabled);
  const clearDiscogsToken = useSettings((s) => s.clearDiscogsToken);

  return (
    <section className="animate-rise">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-fg-heading text-2xl font-semibold">{t('settings:page.title')}</h1>
        <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />} size="sm">
          {t('settings:page.to_collection')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Appearance */}
        <AppearanceCard />

        {/* Discogs */}
        <DiscogsCard
          token={discogsToken}
          username={discogsUsername}
          syncEnabled={discogsSyncEnabled}
          onSave={setDiscogsToken}
          onClear={clearDiscogsToken}
          onSetUsername={setDiscogsUsername}
          onSetSync={setDiscogsSyncEnabled}
        />

        {/* Data — backup / restore */}
        <DataCard />

        {/* Support */}
        <SupportCard />

        {/* About */}
        <AboutCard />
      </div>
    </section>
  );
}

/* ─── Appearance card (language + theme) ─── */

function AppearanceCard() {
  const { t } = useTranslation();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);

  return (
    <CardShell icon={<PaletteIcon />} title={t('settings:page.appearance.title')}>
      <div className="space-y-5">
        <Row label={t('settings:language.title')}>
          <SegmentedControl
            value={locale}
            onChange={(v) => setLocale(v)}
            options={[
              { value: 'ru', label: t('settings:language.ru') },
              { value: 'en', label: t('settings:language.en') },
            ]}
            size="sm"
          />
        </Row>
        <Row label={t('settings:theme.title')}>
          <div className="flex flex-wrap gap-2">
            <ThemeChip mode="light" current={mode} onSelect={setMode} icon={<SunIcon />} label={t('settings:theme.light')} />
            <ThemeChip mode="dark" current={mode} onSelect={setMode} icon={<MoonIcon />} label={t('settings:theme.dark')} />
            <ThemeChip mode="auto" current={mode} onSelect={setMode} icon={<AutoIcon />} label={t('settings:theme.auto')} />
          </div>
        </Row>
      </div>
    </CardShell>
  );
}

function ThemeChip({
  mode,
  current,
  onSelect,
  icon,
  label,
}: {
  mode: ThemeMode;
  current: ThemeMode;
  onSelect: (m: ThemeMode) => void;
  icon: React.ReactNode;
  label: string;
}) {
  const active = mode === current;
  return (
    <button
      key={mode}
      type="button"
      onClick={() => onSelect(mode)}
      className={`flex items-center gap-2 rounded-base px-4 py-2.5 text-sm transition-all duration-200 ${
        active
          ? 'bg-surface text-fg-heading shadow-neu-inset font-medium'
          : 'text-fg-body hover:text-fg-heading shadow-neu-2xs hover:shadow-neu-xs'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Discogs card ─── */

interface DiscogsCardProps {
  token: string;
  username: string;
  syncEnabled: boolean;
  onSave(token: string): Promise<void>;
  onClear(): Promise<void>;
  onSetUsername(u: string): Promise<void>;
  onSetSync(v: boolean): Promise<void>;
}

function DiscogsCard({ token, username, syncEnabled, onSave, onClear, onSetUsername, onSetSync }: DiscogsCardProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; message: string }>({ kind: 'idle', message: '' });
  const [testResult, setTestResult] = useState<{ kind: 'idle' | 'ok' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'clear' | 'test' | 'import' | 'importWantlist' | null>(null);
  const importCounterRef = useRef(0);

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
      console.warn('[discogs] save token failed:', err);
      setStatus({ kind: 'error', message: t('settings:discogs.test_fail', { error: String(err) }) });
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
      console.warn('[discogs] clear failed:', err);
      setStatus({ kind: 'error', message: t('settings:discogs.test_fail', { error: String(err) }) });
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
      const who = res.username ?? '';
      if (who && who !== username) {
        await onSetUsername(who);
      }
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
    setStatus({ kind: 'idle', message: '' });
    const importId = ++importCounterRef.current;
    try {
      const collection = await collectionRepo.ensureDefault();
      const registry = getProvidersRegistry();
      const releases = await registry.fetchDiscogsCollection(username);
      let imported = 0;
      let skipped = 0;
      for (const rel of releases) {
        if (importId !== importCounterRef.current) return;
        const exists = await itemRepo.findBySource('discogs', String(rel.discogsId));
        if (exists) {
          skipped++;
          continue;
        }
        let tracklist: Array<{ position: string; title: string; duration?: number | null }> | undefined;
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
      setStatus({
        kind: 'ok',
        message: t('settings:discogs.import_success', {
          imported,
          skipped,
          total: releases.length,
        }),
      });
    } catch (err) {
      if (importId === importCounterRef.current) {
        setStatus({ kind: 'error', message: t('settings:discogs.import_error', { error: String(err) }) });
      }
    } finally {
      if (importId === importCounterRef.current) setBusy(null);
    }
  };

  const onImportWantlist = async () => {
    if (!username) return;
    setBusy('importWantlist');
    setStatus({ kind: 'idle', message: '' });
    const importId = ++importCounterRef.current;
    try {
      const registry = getProvidersRegistry();
      const wants = await registry.fetchDiscogsWantlist(username);
      let imported = 0;
      let skipped = 0;
      for (const rel of wants) {
        if (importId !== importCounterRef.current) return;
        const already = await wantlistRepo.contains('discogs', String(rel.discogsId));
        if (already) {
          skipped++;
          continue;
        }
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
      setStatus({
        kind: 'ok',
        message: t('settings:discogs.wantlist_import_success', {
          imported,
          skipped,
          total: wants.length,
        }),
      });
    } catch (err) {
      if (importId === importCounterRef.current) {
        setStatus({ kind: 'error', message: t('settings:discogs.import_error', { error: String(err) }) });
      }
    } finally {
      if (importId === importCounterRef.current) setBusy(null);
    }
  };

  return (
    <CardShell
      icon={<VinylIcon />}
      title={t('settings:discogs.title')}
      subtitle={t('settings:discogs.description')}
      badge={
        <Badge ok={hasToken} okLabel={t('settings:discogs.configured')} failLabel={t('settings:discogs.missing')} />
      }
    >
      <div className="space-y-5">
        {/* Token */}
        <form onSubmit={onSubmit}>
          <div className="text-fg-body-subtle mb-1 text-xs uppercase tracking-wide">
            {t('settings:discogs.token_label')}
          </div>
          <div className="rounded-base border-border-default bg-surface shadow-neu-inset relative flex items-center border px-4 py-3">
            <input
              type={inputType}
              className="text-fg-heading w-full bg-transparent pr-8 text-sm outline-none"
              placeholder={
                hasToken && dirty
                  ? ''
                  : hasToken
                    ? t(revealed ? 'settings:discogs.placeholder_configured_revealed' : 'settings:discogs.placeholder_configured_hidden')
                    : t('settings:discogs.placeholder_empty')
              }
              value={displayValue}
              onChange={(e) => {
                setDraft(e.target.value);
                setStatus({ kind: 'idle', message: '' });
              }}
            />
            {hasToken ? (
              <button
                type="button"
                className="text-fg-body-subtle hover:text-fg-heading absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                onClick={() => setRevealed((r) => !r)}
                aria-label={t(revealed ? 'settings:discogs.hide_aria' : 'settings:discogs.show_aria')}
              >
                {revealed ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {dirty || !hasToken ? (
              <Button type="submit" size="sm" disabled={busy === 'save'} leftIcon={busy === 'save' ? undefined : <SaveIcon />}>
                {busy === 'save' ? t('settings:discogs.save_progress') : hasToken ? t('settings:discogs.save_change') : t('settings:discogs.save_new')}
              </Button>
            ) : null}
            {hasToken ? (
              <Button type="button" variant="neutral" size="sm" disabled={busy === 'test'} onClick={onTest} leftIcon={busy === 'test' ? undefined : <NetworkIcon />}>
                {busy === 'test' ? t('settings:discogs.test_progress') : t('settings:discogs.test_button')}
              </Button>
            ) : null}
            {hasToken && !confirmingDelete ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)} leftIcon={<TrashIcon />}>
                {t('settings:discogs.delete_button')}
              </Button>
            ) : null}
            {hasToken && confirmingDelete ? (
              <>
                <span className="text-fg-body-subtle text-xs">{t('settings:discogs.delete_confirm')}</span>
                <Button type="button" variant="danger" size="sm" disabled={busy === 'clear'} onClick={onClearClick}>
                  {busy === 'clear' ? t('settings:discogs.delete_progress') : t('settings:discogs.delete_yes')}
                </Button>
                <Button type="button" variant="neutral" size="sm" onClick={() => setConfirmingDelete(false)}>
                  {t('common:button.cancel')}
                </Button>
              </>
            ) : null}
          </div>
          {testResult ? (
            <div className={`mt-2 text-xs ${testResult.kind === 'ok' ? 'text-fg-brand' : 'text-fg-danger'}`}>
              {testResult.message}
            </div>
          ) : null}
          {status.message ? (
            <div className={`mt-2 text-xs ${status.kind === 'ok' ? 'text-fg-brand' : 'text-fg-danger'}`}>
              {status.message}
            </div>
          ) : null}
        </form>

        {/* Sync toggle + import — only when token is configured */}
        {hasToken ? (
          <div className="space-y-3">
            <Row label={t('settings:discogs.username_label')} value={username || '—'}>
              {!username ? (
                <Button size="sm" variant="neutral" onClick={onTest} disabled={busy === 'test'}>
                  {t('settings:discogs.detect_button')}
                </Button>
              ) : null}
            </Row>

            <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex items-center justify-between gap-4 border px-4 py-3">
              <div>
                <div className="text-fg-heading text-sm font-medium">{t('settings:discogs.sync_label')}</div>
                <div className="text-fg-body-subtle text-xs">{t('settings:discogs.sync_desc')}</div>
              </div>
              <ToggleSwitch checked={syncEnabled} onChange={(v) => onSetSync(v)} ariaLabel={t('settings:discogs.sync_label')} />
            </div>

            <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex items-center justify-between gap-4 border px-4 py-3">
              <div>
                <div className="text-fg-heading text-sm font-medium">{t('settings:discogs.import_label')}</div>
                <div className="text-fg-body-subtle text-xs">{t('settings:discogs.import_desc')}</div>
              </div>
              <Button
                size="sm"
                variant="neutral"
                disabled={busy === 'import' || !username}
                onClick={onImport}
                leftIcon={busy === 'import' ? undefined : <DownloadIcon />}
              >
                {busy === 'import' ? t('common:loading.generic') : t('settings:discogs.import_button')}
              </Button>
            </div>

            <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex items-center justify-between gap-4 border px-4 py-3">
              <div>
                <div className="text-fg-heading text-sm font-medium">{t('settings:discogs.wantlist_import_label')}</div>
                <div className="text-fg-body-subtle text-xs">{t('settings:discogs.wantlist_import_desc')}</div>
              </div>
              <Button
                size="sm"
                variant="neutral"
                disabled={busy === 'importWantlist' || !username}
                onClick={onImportWantlist}
                leftIcon={busy === 'importWantlist' ? undefined : <DownloadIcon />}
              >
                {busy === 'importWantlist' ? t('common:loading.generic') : t('settings:discogs.wantlist_import_button')}
              </Button>
            </div>
          </div>
        ) : null}

        {!hasToken ? (
          <a
            href="https://www.discogs.com/settings/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-brand inline-flex items-center gap-1 text-xs underline underline-offset-2 hover:text-fg-brand-strong"
          >
            {t('settings:discogs.instruction_link')}
            <ExternalLinkIcon />
          </a>
        ) : null}
      </div>
    </CardShell>
  );
}

/* ─── Data card (backup + restore) ─── */

function DataCard() {
  const { t } = useTranslation();
  const showToast = useUi((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onBackup = async () => {
    setBusy(true);
    try {
      const json = serializeDb();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
      const filename = `vinylly-backup-${date}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(t('settings:backup.done', { filename }));
    } catch (e) {
      showToast(t('settings:backup.error', { error: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await restoreFromJsonFile(file);
      showToast(t('settings:backup.restore_done'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast(t('settings:backup.restore_error', { error: String(e) }));
      setBusy(false);
    }
  };

  return (
    <CardShell icon={<ShieldIcon />} title={t('settings:backup.title')} subtitle={t('settings:backup.description')}>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBackup} size="sm" disabled={busy} leftIcon={busy ? undefined : <DownloadIcon />}>
          {busy ? t('common:loading.generic') : t('settings:backup.button')}
        </Button>
        <Button
          variant="neutral"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          leftIcon={busy ? undefined : <UploadIcon />}
        >
          {busy ? t('common:loading.generic') : t('settings:backup.restore_button')}
        </Button>
        <input ref={fileRef} type="file" accept=".json" onChange={onRestore} className="hidden" />
      </div>
    </CardShell>
  );
}

/* ─── Support card ─── */

function SupportCard() {
  const { t } = useTranslation();
  return (
    <CardShell icon={<HeartIcon />} title={t('settings:support.title')} subtitle={t('settings:support.description')}>
      <div className="space-y-2">
        <SupportLink href="https://boosty.to/annenskei/donate" icon={<HeartIcon />} label={t('settings:support.boosty')} />
        <SupportLink href="https://dalink.to/annenskei" icon={<HeartIcon />} label={t('settings:support.donationalerts')} />
        <details className="group rounded-base border-border-default bg-surface shadow-neu-inset border px-4 py-3">
          <summary className="text-fg-heading flex cursor-pointer list-none items-center gap-2.5 text-sm font-medium">
            <CryptoIcon />
            Crypto
            <span className="ml-auto text-fg-body-subtle text-xs group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="mt-3 space-y-2 border-t border-border-default pt-3">
            <CryptoRow label="Bitcoin" addr="bc1qvuhvewu3rjth80wnpdxkrl6vwtgjtspszkcqap" />
            <CryptoRow label="Ethereum" addr="0xc126080ffD216827A37850a5511cf1273E303E73" />
            <CryptoRow label="Solana" addr="516jeJxi1gwaRH7aEEiopAUAGNHKMrUxWv4cfGm32GhB" />
          </div>
        </details>
      </div>
    </CardShell>
  );
}

function SupportLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <ExternalLink
      href={href}
      className="rounded-base border-border-default bg-surface shadow-neu-2xs hover:shadow-neu-xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 border px-4 py-2.5 text-sm transition-all duration-200"
    >
      {icon}
      {label}
    </ExternalLink>
  );
}

function CryptoRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-fg-body-subtle w-14 shrink-0">{label}</span>
      <code className="rounded-sm bg-surface px-2 py-0.5 text-[11px] break-all select-all shadow-neu-2xs">{addr}</code>
    </div>
  );
}

/* ─── About card ─── */

function AboutCard() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    getAppInfo().then(setInfo).catch(() => undefined);
  }, []);

  const rows: Array<{ label: string; value: string }> = [
    { label: t('settings:about.version'), value: info?.version ?? '—' },
    { label: t('settings:about.commit'), value: info?.commit ?? '—' },
    { label: t('settings:about.platform'), value: info?.target ?? '—' },
    {
      label: t('settings:about.built_at'),
      value: info?.builtAt ? new Date(info.builtAt).toISOString().slice(0, 16).replace('T', ' ') : '—',
    },
  ];

  return (
    <CardShell icon={<InfoIcon />} title={t('settings:about.title')} subtitle={info?.name ?? 'Vinylly'}>
      <div className="rounded-base border-border-default bg-surface shadow-neu-inset divide-border-default divide-y border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-fg-body-subtle">{r.label}</span>
            <span className="text-fg-heading ml-4 font-medium">{r.value}</span>
          </div>
        ))}
      </div>
      {info?.repo ? (
        <ExternalLink
          href={info.repo}
          className="mt-3 text-fg-brand hover:text-fg-brand-strong inline-flex items-center gap-1 text-xs underline underline-offset-2"
        >
          <span>{t('settings:about.repo_link')}</span>
          <ExternalLinkIcon />
        </ExternalLink>
      ) : null}
    </CardShell>
  );
}

/* ─── Shared bits ─── */

function CardShell({
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-base bg-surface shadow-neu-inset flex h-10 w-10 shrink-0 items-center justify-center">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-fg-heading text-base font-semibold">{title}</h2>
          {subtitle ? <p className="text-fg-body-subtle mt-0.5 text-xs">{subtitle}</p> : null}
        </div>
        {badge}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Badge({ ok, okLabel, failLabel }: { ok: boolean; okLabel: string; failLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        ok ? 'bg-success-soft text-fg-success-strong' : 'bg-surface text-fg-body-subtle shadow-neu-2xs'
      }`}
    >
      {ok ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
      {ok ? okLabel : failLabel}
    </span>
  );
}

function Row({ label, children, value }: { label: string; children: React.ReactNode; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-fg-body-subtle text-xs uppercase tracking-wide">{label}</div>
        {value ? <div className="text-fg-heading mt-0.5 text-sm">{value}</div> : null}
      </div>
      <div>{children}</div>
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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors ${
        checked
          ? 'bg-surface border-border-default-medium text-fg-brand-strong shadow-neu-inset'
          : 'bg-surface border-border-default shadow-neu-xs'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 translate-y-0 rounded-full border bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4 border-border-default-medium' : 'translate-x-0.5 border-border-default'
        }`}
      />
    </button>
  );
}

/* ─── Icons ─── */

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a3 3 0 0 0 0 6 3 3 0 0 1 0 6 3 3 0 0 0 0 6M19 12a3 3 0 0 0-3-3 3 3 0 0 1-3-3 3 3 0 0 1 3-3" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l6 3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M11 12h1v5h1" strokeLinecap="round" />
    </svg>
  );
}

function VinylIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 21.4l-1.1-1C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c2 0 3.8 1.3 4.5 2.5C12.7 4.3 14.5 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.9 11.9l-1.1 1z" strokeLinejoin="round" />
    </svg>
  );
}

function CryptoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12M8 9h6a3 3 0 0 1 0 6H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 4v12m-5-5 5 5 5-5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 20V8m-5 5 5-5 5 5M5 4h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 5v4h7V5M8 14h8" strokeLinejoin="round" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-3.1 4M6.6 6.6C3.7 8.6 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.3-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3" aria-hidden>
      <path d="M14 4h6v6M10 14L20 4M19 13v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M19 12H5m6-6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}