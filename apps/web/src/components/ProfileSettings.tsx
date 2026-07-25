import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@vinylly/ui';
import { useSettings } from '../lib/settings-store';
import { useProfileStore } from '../lib/profile-store';
import { setProfileSettings, getProfileSettings } from '@vinylly/db';
import { DiscogsPanel } from './DiscogsPanel';

interface ProfileSettingsProps {
  profileId: string | null;
  onClose(): void;
}

export function ProfileSettings({ profileId, onClose }: ProfileSettingsProps) {
  const { t } = useTranslation();
  const profile = useProfileStore((s) =>
    profileId ? s.profiles.find((p) => p.id === profileId) : undefined,
  );
  const activeId = useProfileStore((s) => s.activeId);
  const token = useSettings((s) => s.discogsToken);
  const setToken = useSettings((s) => s.setDiscogsToken);
  const clearToken = useSettings((s) => s.clearDiscogsToken);
  const reload = useSettings((s) => s.reload);

  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });
  const [busy, setBusy] = useState<null | 'save' | 'clear'>(null);

  const isActive = profileId === activeId;
  const inputType = !token ? 'password' : revealed ? 'text' : 'password';

  // If we are viewing a non-active profile, load its settings on mount.
  useEffect(() => {
    if (!profileId || isActive) return;
    let cancelled = false;
    (async () => {
      const settings = await getProfileSettings().catch(() => null);
      if (cancelled || !settings) return;
      useSettings.setState({
        discogsToken: settings.discogsToken,
        discogsUsername: settings.discogsUsername,
        discogsSyncEnabled: settings.discogsSyncEnabled,
        ready: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, isActive]);

  if (!profileId) return null;

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = draft.trim();
    if (!next) {
      setStatus({ kind: 'error', message: t('settings:discogs.error_empty') });
      return;
    }
    setBusy('save');
    setStatus({ kind: 'idle', message: '' });
    try {
      await setProfileSettingsForProfile(profileId, { discogsToken: next });
      if (isActive) await setToken(next);
      setDraft('');
      setRevealed(false);
      setStatus({ kind: 'ok', message: t('settings:discogs.saved_ok') });
      // Refresh settings store so live reads pick up the change.
      await reload();
    } catch (err) {
      setStatus({ kind: 'error', message: t('settings:discogs.test_fail', { error: String(err) }) });
    } finally {
      setBusy(null);
    }
  };

  const onClear = async () => {
    setBusy('clear');
    setStatus({ kind: 'idle', message: '' });
    try {
      await setProfileSettingsForProfile(profileId, {
        discogsToken: '',
        discogsUsername: '',
        discogsSyncEnabled: true,
      });
      if (isActive) await clearToken();
      setDraft('');
      setRevealed(false);
      setConfirmingDelete(false);
      setStatus({ kind: 'ok', message: t('settings:discogs.cleared_ok') });
      await reload();
    } catch (err) {
      setStatus({ kind: 'error', message: t('settings:discogs.test_fail', { error: String(err) }) });
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
    >
      <div className="rounded-base border-border-default bg-surface shadow-neu-xl relative isolate w-full max-w-xl max-h-[90vh] overflow-y-auto border">
        <header className="border-border-default sticky top-0 z-10 flex items-center justify-between border-b bg-surface px-6 py-4">
          <div>
            <h2 id="profile-settings-title" className="text-fg-heading text-lg font-semibold">
              {t('profile:settings.title')}
            </h2>
            <p className="text-fg-body-subtle mt-0.5 text-xs">{profile?.label ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-body-subtle hover:text-fg-heading inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-base transition-neu"
            aria-label={t('common:button.close')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex flex-col gap-6 p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input
              label={t('settings:discogs.token_label')}
              type={inputType}
              autoComplete="off"
              spellCheck={false}
              placeholder={
                token && draft === ''
                  ? t(revealed ? 'settings:discogs.placeholder_configured_revealed' : 'settings:discogs.placeholder_configured_hidden')
                  : t('settings:discogs.placeholder_empty')
              }
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setStatus({ kind: 'idle', message: '' });
              }}
              rightIcon={
                token ? (
                  <button
                    type="button"
                    onClick={() => setRevealed((r) => !r)}
                    aria-label={t(revealed ? 'settings:discogs.hide_aria' : 'settings:discogs.show_aria')}
                    className="text-fg-body-subtle hover:text-fg-heading inline-flex items-center justify-center"
                  >
                    {revealed ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                ) : undefined
              }
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {draft.trim() || !token ? (
                <Button type="submit" size="sm" disabled={busy === 'save'} leftIcon={busy === 'save' ? undefined : <SaveIcon />}>
                  {busy === 'save'
                    ? t('settings:discogs.save_progress')
                    : token
                      ? t('settings:discogs.save_change')
                      : t('settings:discogs.save_new')}
                </Button>
              ) : null}
              {token && !confirmingDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(true)}
                  leftIcon={<TrashIcon />}
                >
                  {t('settings:discogs.delete_button')}
                </Button>
              ) : null}
              {token && confirmingDelete ? (
                <>
                  <span className="text-fg-body-subtle text-xs">{t('settings:discogs.delete_confirm')}</span>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={busy === 'clear'}
                    onClick={() => void onClear()}
                  >
                    {busy === 'clear' ? t('settings:discogs.delete_progress') : t('settings:discogs.delete_yes')}
                  </Button>
                  <Button type="button" variant="neutral" size="sm" onClick={() => setConfirmingDelete(false)}>
                    {t('common:button.cancel')}
                  </Button>
                </>
              ) : null}
            </div>
            {status.message ? (
              <div className={`text-xs ${status.kind === 'ok' ? 'text-fg-brand' : 'text-fg-danger'}`}>
                {status.message}
              </div>
            ) : null}
          </form>

          <DiscogsPanel isActive={isActive} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

async function setProfileSettingsForProfile(
  profileId: string,
  partial: Partial<{ discogsToken: string; discogsUsername: string; discogsSyncEnabled: boolean }>,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> };
  };
  if (!w.__TAURI_INTERNALS__) {
    // Web fallback: the active client can write to non-active profiles only via
    // the live store; we still call setProfileSettings against the bound client
    // (which is the active profile's client). For non-active profiles in web
    // mode we simply persist into a dedicated localStorage key per profile.
    if (profileId !== useProfileStore.getState().activeId) {
      writeWebProfileConfig(profileId, partial);
    } else {
      await setProfileSettings(partial);
    }
    return;
  }
  await w.__TAURI_INTERNALS__.invoke('db_set_profile_config', {
    profileId,
    partial: {
      ...(partial.discogsToken !== undefined ? { discogs_token: partial.discogsToken } : {}),
      ...(partial.discogsUsername !== undefined ? { discogs_username: partial.discogsUsername } : {}),
      ...(partial.discogsSyncEnabled !== undefined ? { discogs_sync_enabled: partial.discogsSyncEnabled } : {}),
    },
  });
}

function writeWebProfileConfig(
  profileId: string,
  partial: Partial<{ discogsToken: string; discogsUsername: string; discogsSyncEnabled: boolean }>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `vinylly:profile-config:${profileId}`;
    const raw = localStorage.getItem(key);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const next = { ...prev, ...partial };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 5v4h7V5M8 14h8" strokeLinejoin="round" />
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
