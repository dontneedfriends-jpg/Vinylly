import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ConfirmModal, PageHeader, SegmentedControl } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useLocale } from '../lib/locale-store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { getAppInfo, type AppInfo } from '../lib/app-info';
import { ExternalLink } from '../components/ExternalLink';
import { BackButton } from '../components/BackButton';
import { serializeDb, restoreFromJsonFile } from '../lib/db';
import { useProfileStore } from '../lib/profile-store';
import { useSettings } from '../lib/settings-store';

export function SettingsPage() {
  const { t } = useTranslation();
  const openCollection = useUi((s) => s.openCollection);

  return (
    <section className="animate-rise max-w-5xl">
      <PageHeader
        level="h1"
        title={t('settings:page.title')}
        actions={
          <BackButton onClick={openCollection} label={t('settings:page.to_collection')} />
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <AppearanceCard />
        <DiscogsMovedCard />
        <DataCard />
        <SupportCard />
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
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as ThemeMode)}
            options={[
              { value: 'light', label: t('settings:theme.light'), icon: <SunIcon /> },
              { value: 'dark', label: t('settings:theme.dark'), icon: <MoonIcon /> },
              { value: 'auto', label: t('settings:theme.auto'), icon: <AutoIcon /> },
            ]}
            size="sm"
            ariaLabel={t('settings:theme.title')}
          />
        </Row>
      </div>
    </CardShell>
  );
}

/* ─── Discogs moved to per-profile settings ─── */

function DiscogsMovedCard() {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const [openSettingsFor, setOpenSettingsFor] = useState<string | null>(null);
  const activeProfile = profiles.find((p) => p.id === activeId);

  return (
    <CardShell icon={<VinylIcon />} title={t('settings:discogs.moved_title')}>
      <p className="text-fg-body text-sm leading-relaxed">
        {t('settings:discogs.moved_body')}
      </p>
      {activeProfile ? (
        <div className="rounded-base border-border-default bg-surface shadow-neu-inset mt-4 flex items-center justify-between gap-3 border px-4 py-3">
          <div className="min-w-0">
            <div className="text-fg-heading text-sm font-medium">{activeProfile.label}</div>
            <div className="text-fg-body-subtle text-xs">{t('settings:discogs.moved_active')}</div>
          </div>
          <Button
            size="sm"
            variant="neutral"
            onClick={() => setOpenSettingsFor(activeProfile.id)}
          >
            {t('settings:discogs.moved_open')}
          </Button>
        </div>
      ) : null}
      <ProfileSettingsModal
        profileId={openSettingsFor}
        onClose={() => setOpenSettingsFor(null)}
      />
    </CardShell>
  );
}

function ProfileSettingsModal({
  profileId,
  onClose,
}: {
  profileId: string | null;
  onClose: () => void;
}) {
  // Lazy import keeps the modal code (and its host shell) out of the
  // SettingsPage bundle's main render path.
  const [Mod, setMod] = useState<React.ComponentType<{ profileId: string | null; onClose: () => void }> | null>(
    null,
  );
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    import('../components/ProfileSettings').then((m) => {
      if (!cancelled) setMod(() => m.ProfileSettings);
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);
  if (!profileId || !Mod) return null;
  return <Mod profileId={profileId} onClose={onClose} />;
}

/* ─── Data card (backup + restore) ─── */

function DataCard() {
  const { t } = useTranslation();
  const showToast = useUi((s) => s.showToast);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<File | null>(null);
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

  const onRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setConfirmRestore(file);
  };

  const doRestore = async () => {
    const file = confirmRestore;
    if (!file) return;
    setBusy(true);
    try {
      await restoreFromJsonFile(file);
      await useSettings.getState().reload();
      await queryClient.invalidateQueries();
      setConfirmRestore(null);
      showToast(t('settings:backup.restore_done'));
    } catch (e) {
      showToast(t('settings:backup.restore_error', { error: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell icon={<ShieldIcon />} title={t('settings:backup.title')} subtitle={t('settings:backup.description')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
      <ConfirmModal
        open={Boolean(confirmRestore)}
        title={t('settings:backup.restore_confirm_title')}
        message={t('settings:backup.restore_confirm_message', { name: confirmRestore?.name ?? '' })}
        confirmLabel={t('settings:backup.restore_button')}
        cancelLabel={t('common:button.cancel')}
        onConfirm={() => void doRestore()}
        onCancel={() => setConfirmRestore(null)}
        loading={busy}
      />
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
            <CryptoRow label={t('settings:support.bitcoin')} addr="bc1qvuhvewu3rjth80wnpdxkrl6vwtgjtspszkcqap" />
            <CryptoRow label={t('settings:support.ethereum')} addr="0xc126080ffD216827A37850a5511cf1273E303E73" />
            <CryptoRow label={t('settings:support.solana')} addr="516jeJxi1gwaRH7aEEiopAUAGNHKMrUxWv4cfGm32GhB" />
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
      className="rounded-base border-border-default bg-surface shadow-neu-2xs hover:shadow-neu-xs text-fg-body hover:text-fg-heading flex items-center gap-2.5 border px-4 py-2.5 text-sm transition-neu"
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
      <code className="rounded-sm bg-surface px-2 py-0.5 text-xs break-all select-all shadow-neu-2xs">{addr}</code>
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
    <div className="rounded-base border-border-default bg-surface shadow-neu-md relative isolate overflow-hidden border p-6">
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

function Row({ label, children, value }: { label: string; children: React.ReactNode; value?: string }) {
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
      <path d="M12 20V8m-5 5 5-5 5 5M5 4h14" strokeLinecap="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3" aria-hidden>
      <path d="M14 4h6v6M10 14L20 4M19 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
