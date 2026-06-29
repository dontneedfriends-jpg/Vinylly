export interface HostPaths {
  readonly dataDir: string;
  readonly coversDir: string;
  readonly dbFile: string;
  readonly cacheDir: string;
}

export interface HostFs {
  readText(path: string): Promise<string>;
  writeText(path: string, contents: string): Promise<void>;
  readBinary(path: string): Promise<Uint8Array>;
  writeBinary(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  join(...parts: string[]): string;
}

export interface HostNet {
  fetchJson<T>(url: string, init?: RequestInit): Promise<T>;
  fetchBinary(url: string, init?: RequestInit): Promise<Uint8Array>;
}

export interface HostShell {
  paths(): HostPaths;
  fs(): HostFs;
  net(): HostNet;
  isPortable(): boolean;
  platform(): 'linux' | 'windows' | 'macos' | 'android' | 'ios' | 'web' | 'unknown';
}
