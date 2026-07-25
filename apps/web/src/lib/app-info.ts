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
    if (typeof window === 'undefined') return fallback;
    const internals = window.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== 'function') return fallback;
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
