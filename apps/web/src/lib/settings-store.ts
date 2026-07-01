import { create } from 'zustand';
import { tryGetHostShell } from '@vinylly/host';

const STORAGE_KEY = 'vinylly:discogs-token';
const ONBOARDING_KEY = 'vinylly:onboarding-done';
const CONFIG_FILE_NAME = 'config.json';

interface SettingsState {
  discogsToken: string;
  onboardingDone: boolean;
  _initialized: boolean;
  setDiscogsToken(token: string): Promise<void>;
  clearDiscogsToken(): Promise<void>;
  setOnboardingDone(): void;
}

function readLocalToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLocalToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
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
    // ignore
  }
}

async function readHostConfig(): Promise<{ discogsToken?: string; onboardingDone?: boolean }> {
  const shell = tryGetHostShell();
  if (!shell) return {};
  try {
    const path = shell.paths().dataDir + '/' + CONFIG_FILE_NAME;
    if (!(await shell.fs().exists(path))) return {};
    const text = await shell.fs().readText(path);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      discogsToken: typeof parsed.discogsToken === 'string' ? parsed.discogsToken : undefined,
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
      // start fresh
    }
    const merged = { ...existing, ...partial };
    await shell.fs().writeText(path, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export const useSettings = create<SettingsState>((set) => ({
  discogsToken: readLocalToken(),
  onboardingDone: readLocalOnboarding(),
  _initialized: false,
  async setDiscogsToken(token) {
    const trimmed = token.trim();
    writeLocalToken(trimmed);
    await writeHostConfig({ discogsToken: trimmed });
    set({ discogsToken: trimmed });
  },
  async clearDiscogsToken() {
    writeLocalToken('');
    await writeHostConfig({ discogsToken: '' });
    set({ discogsToken: '' });
  },
  setOnboardingDone() {
    writeLocalOnboarding(true);
    void writeHostConfig({ onboardingDone: true });
    set({ onboardingDone: true });
  },
}));

export async function initSettings(): Promise<void> {
  if (useSettings.getState()._initialized) return;
  useSettings.setState({ _initialized: true });
  const localToken = readLocalToken();
  const localOnboarding = readLocalOnboarding();
  const host = await readHostConfig();
  if (host.discogsToken !== undefined) {
    if (host.discogsToken !== localToken) writeLocalToken(host.discogsToken);
    useSettings.setState({ discogsToken: host.discogsToken });
  } else if (localToken) {
    useSettings.setState({ discogsToken: localToken });
  }
  if (host.onboardingDone !== undefined) {
    if (host.onboardingDone !== localOnboarding) writeLocalOnboarding(host.onboardingDone);
    useSettings.setState({ onboardingDone: host.onboardingDone });
  }
}
