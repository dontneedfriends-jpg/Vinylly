export interface AppInfo {
  name: string;
  version: string;
  commit: string;
  builtAt: string;
  target: string;
  repo: string;
}

const DEFAULT_REPO = 'https://github.com/vinylly/vinylly';

let cache: Promise<AppInfo> | null = null;

interface TauriInternals {
  invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
}

function getTauriInternals(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TAURI_INTERNALS__?: TauriInternals };
  return w.__TAURI_INTERNALS__ ?? null;
}

export function getAppInfo(): Promise<AppInfo> {
  if (cache) return cache;

  const fallback: AppInfo = {
    name: 'Vinylly',
    version: import.meta.env['VITE_APP_VERSION'] ?? '0.1.0',
    commit: import.meta.env['VITE_GIT_COMMIT'] ?? 'dev',
    builtAt: import.meta.env['VITE_BUILD_TIMESTAMP'] ?? new Date().toISOString(),
    target: 'web',
    repo: import.meta.env['VITE_GIT_REPOSITORY'] ?? DEFAULT_REPO,
  };

  cache = (async () => {
    const internals = getTauriInternals();
    if (!internals) return fallback;
    try {
      const info = await internals.invoke('app_info');
      return info as AppInfo;
    } catch {
      return fallback;
    }
  })();

  return cache;
}

export function buildInfoText(info: AppInfo): string {
  if (info.commit && info.commit !== 'dev') {
    return `${info.version} · ${info.commit}`;
  }
  return info.version;
}
