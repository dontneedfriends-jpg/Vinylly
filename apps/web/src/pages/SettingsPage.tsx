import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Input,
  SegmentedControl,
} from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useSettings } from '../lib/settings-store';
import { useLocale } from '../lib/locale-store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { getAppInfo, type AppInfo } from '../lib/app-info';
import { resetProvidersRegistry } from '../lib/providers';
import { getHostShell } from '@vinylly/host';
import { ExternalLink } from '../components/ExternalLink';
import { serializeDb, restoreFromJsonFile } from '../lib/db';

type SettingsTab = 'language' | 'theme' | 'backup' | 'discogs' | 'about';

const tabs: { id: SettingsTab; icon: React.ReactNode; labelKey: string }[] = [
  { id: 'language', icon: <GlobeIcon />, labelKey: 'settings:language.title' },
  { id: 'theme', icon: <PaletteIcon />, labelKey: 'Оформление' },
  { id: 'backup', icon: <ShieldIcon />, labelKey: 'settings:backup.title' },
  { id: 'discogs', icon: <VinylIcon />, labelKey: 'settings:discogs.title' },
  { id: 'about', icon: <InfoIcon />, labelKey: 'О приложении' },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('language');
  const openCollection = useUi((s) => s.openCollection);
  const discogsToken = useSettings((s) => s.discogsToken);
  const setDiscogsToken = useSettings((s) => s.setDiscogsToken);
  const clearDiscogsToken = useSettings((s) => s.clearDiscogsToken);

  return (
    <section className="animate-rise">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-fg-heading text-2xl font-semibold">{t('settings:page.title')}</h1>
        <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />} size="sm">
          {t('settings:page.to_collection')}
        </Button>
      </div>

      <div className="flex gap-8">
        <nav className="w-48 shrink-0">
          <div className="rounded-base border-border-default bg-surface shadow-neu-md flex flex-col gap-1 border p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-base px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-surface text-fg-heading shadow-neu-inset font-medium'
                    : 'text-fg-body hover:text-fg-heading shadow-neu-2xs hover:shadow-neu-xs'
                }`}
              >
                <span className="h-5 w-5 shrink-0">{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {activeTab === 'language' ? <LanguageSection /> : null}
          {activeTab === 'theme' ? <ThemeSection /> : null}
          {activeTab === 'backup' ? <BackupSection /> : null}
          {activeTab === 'discogs' ? (
            <DiscogsSection token={discogsToken} onSave={setDiscogsToken} onClear={clearDiscogsToken} />
          ) : null}
          {activeTab === 'about' ? <AboutSection /> : null}
        </div>
      </div>

      <SupportSection />
    </section>
  );
}

function LanguageSection() {
  const { t } = useTranslation();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);

  return (
    <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-8">
      <div className="flex items-start gap-5">
        <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
          <GlobeIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-fg-heading text-lg font-semibold">{t('settings:language.title')}</h2>
        </div>
      </div>
      <div className="mt-6">
        <SegmentedControl
          value={locale}
          onChange={(v) => setLocale(v)}
          options={[
            { value: 'ru', label: t('settings:language.ru') },
            { value: 'en', label: t('settings:language.en') },
          ]}
          size="sm"
        />
      </div>
    </div>
  );
}

function BackupSection() {
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
    <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-8">
      <div className="flex items-start gap-5">
        <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
          <ShieldIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-fg-heading text-lg font-semibold">{t('settings:backup.title')}</h2>
          <p className="text-fg-body-subtle mt-1 text-sm">{t('settings:backup.description')}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={onBackup} disabled={busy} leftIcon={busy ? undefined : <DownloadIcon />}>
          {busy ? t('common:loading.generic') : t('settings:backup.button')}
        </Button>
        <Button
          variant="neutral"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          leftIcon={busy ? undefined : <UploadIcon />}
        >
          {busy ? t('common:loading.generic') : t('settings:backup.restore_button')}
        </Button>
        <input ref={fileRef} type="file" accept=".json" onChange={onRestore} className="hidden" />
      </div>
    </div>
  );
}

interface DiscogsSectionProps {
  token: string;
  onSave(token: string): Promise<void>;
  onClear(): Promise<void>;
}

function DiscogsSection({ token, onSave, onClear }: DiscogsSectionProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; message: string }>({ kind: 'idle', message: '' });
  const [testResult, setTestResult] = useState<{ kind: 'idle' | 'ok' | 'error'; message: string } | null>(null);
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
    <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-8">
      <div className="flex items-start gap-5">
        <div className="rounded-base bg-brand-softer border-border-brand-subtle flex h-12 w-12 shrink-0 items-center justify-center border">
          <VinylIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <h2 className="text-fg-heading text-lg font-semibold">{t('settings:discogs.title')}</h2>
            <Badge tone={hasToken ? 'success' : 'warning'} pill>
              {hasToken ? t('settings:discogs.configured') : t('settings:discogs.missing')}
            </Badge>
          </div>
          <p className="text-fg-body-subtle mt-1 text-sm">{t('settings:discogs.description')}</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
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

        <form onSubmit={onSubmit} className="space-y-5">
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

          <div className="flex items-center justify-end gap-3">
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
        </form>
      </div>
    </div>
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

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}

function ThemeSection() {
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Светлая', icon: <SunIcon /> },
    { value: 'dark', label: 'Тёмная', icon: <MoonIcon /> },
    { value: 'system', label: 'Системная', icon: <MonitorIcon /> },
  ];

  return (
    <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-8">
      <div className="flex items-start gap-5">
        <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
          <PaletteIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-fg-heading text-lg font-semibold">Оформление</h2>
          <p className="text-fg-body-subtle mt-1 text-sm">Переключение между светлой и тёмной темой</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setMode(o.value)}
            className={`flex items-center gap-2 rounded-base px-4 py-2.5 text-sm transition-all duration-200 ${
              o.value === mode
                ? 'bg-surface text-fg-heading shadow-neu-inset font-medium'
                : 'text-fg-body hover:text-fg-heading shadow-neu-2xs hover:shadow-neu-xs'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void getAppInfo().then(setInfo);
  }, []);

  const rows: { label: string; value: string }[] = [
    { label: 'Версия', value: info?.version ?? '—' },
    { label: 'Коммит', value: info?.commit ?? '—' },
    { label: 'Платформа', value: info?.target ?? '—' },
    {
      label: 'Сборка',
      value: info?.builtAt ? new Date(info.builtAt).toISOString().slice(0, 16).replace('T', ' ') : '—',
    },
  ];

  return (
    <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-8">
      <div className="flex items-start gap-5">
        <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
          <InfoIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-fg-heading text-lg font-semibold">О приложении</h2>
          <p className="text-fg-body-subtle mt-1 text-sm">{info?.name ?? 'Vinylly'}</p>
        </div>
      </div>
      <div className="mt-6">
        <div className="rounded-base border-border-default bg-surface shadow-neu-inset divide-border-default divide-y border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-6 py-4 text-sm">
              <span className="text-fg-body-subtle">{r.label}</span>
              <span className="text-fg-heading ml-4 font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      {info?.repo ? (
        <div className="mt-4">
          <ExternalLink
            href={info.repo}
            className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading inline-flex items-center gap-2 px-4 py-3 text-sm transition-all duration-200"
          >
            <ExternalLinkIcon />
            Исходный код на GitHub
          </ExternalLink>
        </div>
      ) : null}
    </div>
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

function SupportSection() {
  const { t } = useTranslation();

  return (
    <div className="mt-10">
      <div className="rounded-base border-border-default bg-surface shadow-neu-md border p-8">
        <div className="flex items-start gap-5">
          <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
            <HeartIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-fg-heading text-lg font-semibold">{t('settings:support.title')}</h2>
            <p className="text-fg-body-subtle mt-1 text-sm">{t('settings:support.description')}</p>
          </div>
        </div>
        <div className="mt-6">
          <div className="rounded-base border-border-default bg-surface shadow-neu-inset flex flex-col gap-3 border px-6 py-5">
            <ExternalLink
              href="https://boosty.to/annenskei/donate"
              className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 px-2 py-2 text-sm transition-all duration-200"
            >
              <HeartIcon />
              {t('settings:support.boosty')}
            </ExternalLink>
            <ExternalLink
              href="https://dalink.to/annenskei"
              className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 px-2 py-2 text-sm transition-all duration-200"
            >
              <HeartIcon />
              {t('settings:support.donationalerts')}
            </ExternalLink>
            <details className="group">
              <summary className="rounded-base hover:shadow-neu-2xs text-fg-body hover:text-fg-heading flex cursor-pointer items-center gap-2.5 px-2 py-2 text-sm transition-all duration-200">
                <CryptoIcon />
                <span className="text-fg-heading font-medium">Crypto</span>
              </summary>
              <div className="mt-2 space-y-2 border-t border-border-default pt-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-fg-body-subtle w-14 shrink-0">Bitcoin</span>
                  <code className="rounded-sm bg-surface px-2 py-0.5 text-[11px] break-all select-all shadow-neu-2xs">
                    bc1qvuhvewu3rjth80wnpdxkrl6vwtgjtspszkcqap
                  </code>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-fg-body-subtle w-14 shrink-0">Ethereum</span>
                  <code className="rounded-sm bg-surface px-2 py-0.5 text-[11px] break-all select-all shadow-neu-2xs">
                    0xc126080ffD216827A37850a5511cf1273E303E73
                  </code>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-fg-body-subtle w-14 shrink-0">Solana</span>
                  <code className="rounded-sm bg-surface px-2 py-0.5 text-[11px] break-all select-all shadow-neu-2xs">
                    516jeJxi1gwaRH7aEEiopAUAGNHKMrUxWv4cfGm32GhB
                  </code>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VinylIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L19 4M15 8l3 3M18 5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M3 3l18 18M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.6 17.6 0 0 1-3.2 4M6.6 6.6A17.7 17.7 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.2 3.9-.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4" aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
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

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 4v12M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}
