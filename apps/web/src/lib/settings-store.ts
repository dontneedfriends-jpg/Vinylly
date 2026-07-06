import { create } from 'zustand';
import { tryGetHostShell } from '@vinylly/host';

const STORAGE_KEY = 'vinylly:discogs-token';
const USERNAME_KEY = 'vinylly:discogs-username';
const SYNC_KEY = 'vinylly:discogs-sync';
const ONBOARDING_KEY = 'vinylly:onboarding-done';
const CONFIG_FILE_NAME = 'config.json';

interface SettingsState {
  discogsToken: string;
  discogsUsername: string;
  discogsSyncEnabled: boolean;
  onboardingDone: boolean;
  _initialized: boolean;
  setDiscogsToken(token: string): Promise<void>;
  clearDiscogsToken(): Promise<void>;
  setDiscogsUsername(username: string): Promise<void>;
  setDiscogsSyncEnabled(enabled: boolean): Promise<void>;
  setOnboardingDone(): void;
}

function readLocalToken(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
}
function writeLocalToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

function readLocalUsername(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(USERNAME_KEY) ?? ''; } catch { return ''; }
}
function writeLocalUsername(u: string): void {
  if (typeof window === 'undefined') return;
  try { if (u) localStorage.setItem(USERNAME_KEY, u); else localStorage.removeItem(USERNAME_KEY); } catch {}
}
function readLocalSync(): boolean {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem(SYNC_KEY) !== 'false'; } catch { return true; }
}
function writeLocalSync(v: boolean): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(SYNC_KEY, String(v)); } catch {}
}

function readLocalOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(ONBOARDING_KEY) === 'true'; } catch { return false; }
}
function writeLocalOnboarding(done: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (done) localStorage.setItem(ONBOARDING_KEY, 'true');
    else localStorage.removeItem(ONBOARDING_KEY);
  } catch { /* ignore */ }
}

async function readHostConfig(): Promise<{
  discogsToken?: string;
  discogsUsername?: string;
  discogsSyncEnabled?: boolean;
  onboardingDone?: boolean;
}> {
  const shell = tryGetHostShell();
  if (!shell) return {};
  try {
    const path = shell.paths().dataDir + '/' + CONFIG_FILE_NAME;
    if (!(await shell.fs().exists(path))) return {};
    const text = await shell.fs().readText(path);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      discogsToken: typeof parsed.discogsToken === 'string' ? parsed.discogsToken : undefined,
      discogsUsername: typeof parsed.discogsUsername === 'string' ? parsed.discogsUsername : undefined,
      discogsSyncEnabled: typeof parsed.discogsSyncEnabled === 'boolean' ? parsed.discogsSyncEnabled : undefined,
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
    } catch { /* start fresh */ }
    const merged = { ...existing, ...partial };
    await shell.fs().writeText(path, JSON.stringify(merged));
  } catch { /* ignore */ }
}

export const useSettings = create<SettingsState>((set) => ({
  discogsToken: readLocalToken(),
  discogsUsername: readLocalUsername(),
  discogsSyncEnabled: readLocalSync(),
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
    writeLocalUsername('');
    writeLocalSync(true);
    await writeHostConfig({ discogsToken: '', discogsUsername: '' });
    set({ discogsToken: '', discogsUsername: '', discogsSyncEnabled: true });
  },
  async setDiscogsUsername(username) {
    writeLocalUsername(username);
    await writeHostConfig({ discogsUsername: username });
    set({ discogsUsername: username });
  },
  async setDiscogsSyncEnabled(enabled) {
    writeLocalSync(enabled);
    await writeHostConfig({ discogsSyncEnabled: enabled });
    set({ discogsSyncEnabled: enabled });
  },
  setOnboardingDone() {
    writeLocalOnboarding(true);
    void writeHostConfig({ onboardingDone: true });
    set({ onboardingDone: true });
  },
}));

export async function initSettings(): Promise<void> {
  if (useSettings.getState()._initialized) return;
  initPromise = doInit();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

let initPromise: Promise<void> | null = null;

async function doInit(): Promise<void> {
  useSettings.setState({ _initialized: true });
  const localToken = readLocalToken();
  const localUsername = readLocalUsername();
  const localSync = readLocalSync();
  const localOnboarding = readLocalOnboarding();
  const host = await readHostConfig();
  if (host.discogsToken !== undefined) {
    if (host.discogsToken !== localToken) writeLocalToken(host.discogsToken);
    useSettings.setState({ discogsToken: host.discogsToken });
  } else if (localToken) {
    useSettings.setState({ discogsToken: localToken });
  }
  if (host.discogsUsername !== undefined) {
    if (host.discogsUsername !== localUsername) writeLocalUsername(host.discogsUsername);
    useSettings.setState({ discogsUsername: host.discogsUsername });
  } else if (localUsername) {
    useSettings.setState({ discogsUsername: localUsername });
  }
  if (host.discogsSyncEnabled !== undefined) {
    if (host.discogsSyncEnabled !== localSync) writeLocalSync(host.discogsSyncEnabled);
    useSettings.setState({ discogsSyncEnabled: host.discogsSyncEnabled });
  } else {
    useSettings.setState({ discogsSyncEnabled: localSync });
  }
  if (host.onboardingDone !== undefined) {
    if (host.onboardingDone !== localOnboarding) writeLocalOnboarding(host.onboardingDone);
    useSettings.setState({ onboardingDone: host.onboardingDone });
  }
}