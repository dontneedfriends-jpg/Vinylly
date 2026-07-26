import { create } from 'zustand';
import { tryGetHostShell } from '@vinylly/host';
import { getProfileSettings, setProfileSettings, type ProfileSettings as DbProfileSettings } from '@vinylly/db';

const ONBOARDING_KEY = 'vinylly:onboarding-done';
const CONFIG_FILE_NAME = 'config.json';

interface SettingsState {
  /** Once profile settings have been read into the store. */
  ready: boolean;
  onboardingDone: boolean;
  // Per-profile Discogs settings.
  discogsToken: string;
  discogsUsername: string;
  discogsSyncEnabled: boolean;
  discogsPriceFieldId: number | null;
  setOnboardingDone(): void;
  setDiscogsToken(token: string): Promise<void>;
  clearDiscogsToken(): Promise<void>;
  setDiscogsUsername(username: string): Promise<void>;
  setDiscogsSyncEnabled(enabled: boolean): Promise<void>;
  setDiscogsPriceFieldId(fieldId: number | null): Promise<void>;
  /** Reload profile settings (call after a profile switch). */
  reload(): Promise<void>;
}

function readLocalOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeLocalOnboarding(done: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (done) localStorage.setItem(ONBOARDING_KEY, 'true');
    else localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    /* ignore */
  }
}

async function readHostConfig(): Promise<{ onboardingDone?: boolean }> {
  const shell = tryGetHostShell();
  if (!shell) return {};
  try {
    const path = shell.paths().dataDir + '/' + CONFIG_FILE_NAME;
    if (!(await shell.fs().exists(path))) return {};
    const text = await shell.fs().readText(path);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      onboardingDone: typeof parsed.onboardingDone === 'boolean' ? parsed.onboardingDone : undefined,
    };
  } catch {
    return {};
  }
}

async function writeHostConfig(partial: Record<string, unknown>): Promise<void> {
  const shell = tryGetHostShell();
  if (!shell) return;
  try {
    const path = shell.paths().dataDir + '/' + CONFIG_FILE_NAME;
    const existing: Record<string, unknown> = {};
    try {
      if (await shell.fs().exists(path)) {
        const text = await shell.fs().readText(path);
        Object.assign(existing, JSON.parse(text) as Record<string, unknown>);
      }
    } catch {
      /* start fresh */
    }
    const merged = { ...existing, ...partial };
    await shell.fs().writeText(path, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
}

export const useSettings = create<SettingsState>((set) => ({
  ready: false,
  onboardingDone: readLocalOnboarding(),
  discogsToken: '',
  discogsUsername: '',
  discogsSyncEnabled: true,
  discogsPriceFieldId: null,
  setOnboardingDone() {
    writeLocalOnboarding(true);
    void writeHostConfig({ onboardingDone: true });
    set({ onboardingDone: true });
  },
  async setDiscogsToken(token) {
    const trimmed = token.trim();
    const next = await setProfileSettings({ discogsToken: trimmed });
    set({ ...next });
  },
  async clearDiscogsToken() {
    const next = await setProfileSettings({
      discogsToken: '',
      discogsUsername: '',
      discogsSyncEnabled: true,
      discogsPriceFieldId: null,
    });
    set({ ...next });
  },
  async setDiscogsUsername(username) {
    const next = await setProfileSettings({ discogsUsername: username });
    set({ ...next });
  },
  async setDiscogsSyncEnabled(enabled) {
    const next = await setProfileSettings({ discogsSyncEnabled: enabled });
    set({ ...next });
  },
  async setDiscogsPriceFieldId(fieldId) {
    const next = await setProfileSettings({ discogsPriceFieldId: fieldId });
    set({ ...next });
  },
  async reload() {
    const settings = await getProfileSettings().catch<DbProfileSettings>(() => ({
      discogsToken: '',
      discogsUsername: '',
      discogsSyncEnabled: true,
      discogsPriceFieldId: null,
    }));
    set({ ...settings, ready: true });
  },
}));

export async function initSettings(): Promise<void> {
  // Onboarding: global, persisted in localStorage + host config.
  const localOnboarding = readLocalOnboarding();
  const host = await readHostConfig();
  if (host.onboardingDone !== undefined) {
    if (host.onboardingDone !== localOnboarding) writeLocalOnboarding(host.onboardingDone);
    useSettings.setState({ onboardingDone: host.onboardingDone });
  } else if (localOnboarding) {
    useSettings.setState({ onboardingDone: localOnboarding });
  }

  // Profile-scoped Discogs settings. Reload via DB layer.
  await useSettings.getState().reload();
}
