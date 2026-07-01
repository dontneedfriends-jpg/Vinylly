import type { HostFs, HostNet, HostPaths, HostShell } from './types';

interface TauriInternals {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

interface TauriDataPaths {
  data_dir: string;
  covers_dir: string;
  cache_dir: string;
  db_file: string;
  portable: boolean;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
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

export async function createTauriHostShell(): Promise<HostShell> {
  if (!isTauriEnvironment()) {
    throw new Error('Not in Tauri environment');
  }
  const init = await window.__TAURI_INTERNALS__!.invoke<TauriDataPaths>('host_init_app', {});
  const paths: HostPaths = {
    dataDir: init.data_dir,
    coversDir: init.covers_dir,
    cacheDir: init.cache_dir,
    dbFile: init.db_file,
  };
  const fs = new TauriHostFs();
  const net = new TauriHostNet();
  const platform = await window.__TAURI_INTERNALS__!.invoke<string>('host_platform');
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
