import { create } from 'zustand';
import { tryGetHostShell } from '@vinylly/host';

const STORAGE_KEY = 'vinylly:discogs-token';
const CONFIG_FILE_NAME = 'config.json';

interface SettingsState {
  discogsToken: string;
  _initialized: boolean;
  setDiscogsToken(token: string): Promise<void>;
  clearDiscogsToken(): Promise<void>;
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

async function readHostToken(): Promise<string | null> {
  const shell = tryGetHostShell();
  if (!shell) return null;
  try {
    const path = shell.paths().dataDir + '/' + CONFIG_FILE_NAME;
    if (!(await shell.fs().exists(path))) return null;
    const text = await shell.fs().readText(path);
    const parsed = JSON.parse(text) as { discogsToken?: unknown };
    return typeof parsed.discogsToken === 'string' ? parsed.discogsToken : null;
  } catch {
    return null;
  }
}

async function writeHostToken(token: string): Promise<void> {
  const shell = tryGetHostShell();
  if (!shell) return;
  try {
    const path = shell.paths().dataDir + '/' + CONFIG_FILE_NAME;
    const json = JSON.stringify({ discogsToken: token });
    await shell.fs().writeText(path, json);
  } catch {
    // ignore — localStorage copy is still authoritative for the session
  }
}

export const useSettings = create<SettingsState>((set) => ({
  discogsToken: readLocalToken(),
  _initialized: false,
  async setDiscogsToken(token) {
    const trimmed = token.trim();
    writeLocalToken(trimmed);
    await writeHostToken(trimmed);
    set({ discogsToken: trimmed });
  },
  async clearDiscogsToken() {
    writeLocalToken('');
    await writeHostToken('');
    set({ discogsToken: '' });
  },
}));

export async function initSettings(): Promise<void> {
  if (useSettings.getState()._initialized) return;
  useSettings.setState({ _initialized: true });
  const local = readLocalToken();
  const fromHost = await readHostToken();
  if (fromHost !== null) {
    if (fromHost !== local) writeLocalToken(fromHost);
    useSettings.setState({ discogsToken: fromHost });
  } else if (local) {
    useSettings.setState({ discogsToken: local });
  }
}
