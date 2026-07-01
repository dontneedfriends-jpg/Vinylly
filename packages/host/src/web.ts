import type { HostFs, HostNet, HostPaths, HostShell } from './types';

class WebHostFs implements HostFs {
  async readText(path: string): Promise<string> {
    const v = localStorage.getItem(this.key(path));
    if (v === null) throw new Error(`readText: not found ${path}`);
    return v;
  }
  async writeText(path: string, contents: string): Promise<void> {
    localStorage.setItem(this.key(path), contents);
  }
  async readBinary(path: string): Promise<Uint8Array> {
    const b64 = localStorage.getItem(this.key(path));
    if (!b64) throw new Error(`readBinary: not found ${path}`);
    return base64ToBytes(b64);
  }
  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    localStorage.setItem(this.key(path), bytesToBase64(data));
  }
  async exists(path: string): Promise<boolean> {
    return localStorage.getItem(this.key(path)) !== null;
  }
  async ensureDir(_path: string): Promise<void> {
    // no-op in browser fallback
  }
  async remove(path: string): Promise<void> {
    localStorage.removeItem(this.key(path));
  }
  async list(dir: string): Promise<string[]> {
    const prefix = this.key(dir) + '/';
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
    return out;
  }
  join(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  }
  private key(path: string): string {
    return `vinylly:${path}`;
  }
}

class WebHostNet implements HostNet {
  async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`fetchJson failed: ${res.status} ${url}`);
    return (await res.json()) as T;
  }
  async fetchBinary(url: string, init?: RequestInit): Promise<Uint8Array> {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`fetchBinary failed: ${res.status} ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

export function createWebHostShell(): HostShell {
  const fs = new WebHostFs();
  const net = new WebHostNet();
  const paths: HostPaths = {
    dataDir: 'vinylly',
    coversDir: 'vinylly/covers',
    cacheDir: 'vinylly/cache',
    dbFile: 'vinylly/db.sqlite',
  };
  return {
    paths: () => paths,
    fs: () => fs,
    net: () => net,
    openUrl: async (url: string) => {
      window.open(url, '_blank', 'noopener');
    },
    isPortable: () => true,
    platform: () => 'web',
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
