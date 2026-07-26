import type { HostFs, HostNet, HostPaths, HostShell } from './types';

interface TauriDataPaths {
  data_dir: string;
  covers_dir: string;
  cache_dir: string;
  db_file: string;
  profiles_index: string;
  portable: boolean;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
      transformCallback?: <T>(callback: T, once?: boolean) => number;
      metadata?: { currentWindow: { label: string } } & Record<string, unknown>;
      convertFileSrc?: (filePath: string, protocol?: string) => string;
    };
  }
}

/**
 * Heuristic check for a real Tauri host. Some dev tools (Vite HMR, browser
 * extensions, stub packages) attach `__TAURI_INTERNALS__` as a fake object
 * with a no-op `invoke`; we want to ignore those and force the web path.
 *
 * In a real Tauri runtime `__TAURI_INTERNALS__` carries the full IPC
 * surface (`invoke`, `transformCallback`, `metadata`, `convertFileSrc`,
 * …). In a fake stub only `invoke` is present. We require at least two
 * of these markers to consider the host real.
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const internals = window.__TAURI_INTERNALS__;
  if (!internals || typeof internals.invoke !== 'function') return false;
  let markerCount = 0;
  if (typeof internals.transformCallback === 'function') markerCount += 1;
  if (internals.metadata && typeof internals.metadata === 'object') markerCount += 1;
  if (typeof internals.convertFileSrc === 'function') markerCount += 1;
  return markerCount >= 1;
}

class TauriHostFs implements HostFs {
  async readText(path: string): Promise<string> {
    return window.__TAURI_INTERNALS__!.invoke<string>('fs_read_text', { path });
  }
  async writeText(path: string, contents: string): Promise<void> {
    await window.__TAURI_INTERNALS__!.invoke('fs_write_text', { path, contents });
  }
  async readBinary(path: string): Promise<Uint8Array> {
    const bytes = await window.__TAURI_INTERNALS__!.invoke<number[]>('fs_read_binary', { path });
    return new Uint8Array(bytes);
  }
  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    await window.__TAURI_INTERNALS__!.invoke('fs_write_binary', {
      path,
      data: Array.from(data),
    });
  }
  async exists(path: string): Promise<boolean> {
    return window.__TAURI_INTERNALS__!.invoke<boolean>('fs_exists', { path });
  }
  async ensureDir(path: string): Promise<void> {
    await window.__TAURI_INTERNALS__!.invoke('fs_ensure_dir', { path });
  }
  async remove(path: string): Promise<void> {
    await window.__TAURI_INTERNALS__!.invoke('fs_remove', { path });
  }
  async list(dir: string): Promise<string[]> {
    const entries = await window.__TAURI_INTERNALS__!.invoke<
      Array<{ name: string; path: string; is_dir: boolean; size: number }>
    >('fs_list', { dir });
    return entries.map((e) => e.name);
  }
  join(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  }
}

class TauriHostNet implements HostNet {
  async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const headers: Array<[string, string]> = [];
    if (init?.headers) {
      const h = init.headers;
      if (h instanceof Headers) {
        h.forEach((v, k) => headers.push([k, v]));
      } else if (Array.isArray(h)) {
        for (const [k, v] of h) headers.push([k, v]);
      } else {
        for (const [k, v] of Object.entries(h)) headers.push([k, String(v)]);
      }
    }
    const body = typeof init?.body === 'string' ? init.body : undefined;
    const method = init?.method;
    const resp = await window.__TAURI_INTERNALS__!.invoke<{
      status: number;
      ok: boolean;
      text: string;
    }>('net_fetch', { url, init: { method, headers, body } });
    if (!resp.ok) {
      throw new Error(`fetchJson failed: ${resp.status} ${url}`);
    }
    // 204 No Content (e.g. Discogs field update) — empty body is success.
    if (!resp.text || !resp.text.trim()) return null as T;
    return JSON.parse(resp.text) as T;
  }
  async fetchBinary(url: string, init?: RequestInit): Promise<Uint8Array> {
    const headers: Array<[string, string]> = [];
    if (init?.headers) {
      const h = init.headers;
      if (h instanceof Headers) {
        h.forEach((v, k) => headers.push([k, v]));
      } else if (Array.isArray(h)) {
        for (const [k, v] of h) headers.push([k, v]);
      } else {
        for (const [k, v] of Object.entries(h)) headers.push([k, String(v)]);
      }
    }
    const body = typeof init?.body === 'string' ? init.body : undefined;
    const method = init?.method;
    const bytes = await window.__TAURI_INTERNALS__!.invoke<number[]>('net_fetch_binary', {
      url,
      init: { method, headers, body },
    });
    return new Uint8Array(bytes);
  }
}

/**
 * Build a Tauri-backed HostShell for the given profile id.
 *
 * Cover / cache / db paths are scoped to the active profile. The root
 * `data/` directory and the `data/profiles.json` index remain shared
 * across profiles.
 *
 * Bounded by a 1500 ms timeout — if the Rust side is missing or hung
 * (e.g. when this code runs in plain browser dev mode that has a stub
 * `__TAURI_INTERNALS__`), we throw so the caller can fall back to the
 * web shell instead of blocking the UI forever.
 */
export async function createTauriHostShell(profileId: string): Promise<HostShell> {
  if (!isTauriEnvironment()) {
    throw new Error('Not in Tauri environment');
  }
  const invoke = window.__TAURI_INTERNALS__!.invoke;
  const init = await Promise.race([
    invoke<TauriDataPaths>('host_init_app', {}),
    new Promise<TauriDataPaths>((_, reject) =>
      setTimeout(() => reject(new Error('createTauriHostShell: host_init_app timed out')), 1500),
    ),
  ]);
  const profileRoot = `${init.data_dir}/profiles/${profileId}`;
  const paths: HostPaths = {
    dataDir: init.data_dir,
    coversDir: `${profileRoot}/covers`,
    cacheDir: init.cache_dir,
    dbFile: `${profileRoot}/db.json`,
  };
  const fs = new TauriHostFs();
  const net = new TauriHostNet();
  const platform = await Promise.race([
    invoke<string>('host_platform'),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('createTauriHostShell: host_platform timed out')), 1500),
    ),
  ]);
  return {
    paths: () => paths,
    fs: () => fs,
    net: () => net,
    openUrl: async (url: string) => {
      await window.__TAURI_INTERNALS__!.invoke('host_shell_open', { url });
    },
    isPortable: () => init.portable,
    platform: () =>
      platform as 'linux' | 'windows' | 'macos' | 'android' | 'ios' | 'web' | 'unknown',
  };
}
