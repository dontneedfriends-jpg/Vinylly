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
  openUrl(url: string): Promise<void>;
  isPortable(): boolean;
  platform(): 'linux' | 'windows' | 'macos' | 'android' | 'ios' | 'web' | 'unknown';
}

/** A single profile entry — owned by a profile store. */
export interface ProfileRecord {
  id: string;
  label: string;
  createdAt: string;
}

/** On-disk shape of `data/profiles.json`. */
export interface ProfilesIndex {
  profiles: ProfileRecord[];
  activeId: string | null;
}

/** Per-profile runtime configuration (Discogs token, sync flag). */
export interface ProfileConfig {
  discogsToken: string;
  discogsUsername: string;
  discogsSyncEnabled: boolean;
}

/** Tauri-side profile commands exposed via `__TAURI_INTERNALS__.invoke`. */
export interface ProfileCommands {
  db_list_profiles(): Promise<ProfilesIndex & { activeId: string | null }>;
  db_create_profile(label: string, setActive?: boolean): Promise<{
    profile: ProfileRecord;
    activeId: string | null;
  }>;
  db_rename_profile(id: string, label: string): Promise<ProfileRecord>;
  db_delete_profile(id: string): Promise<void>;
  db_set_active_profile(id: string): Promise<void>;
  db_get_profile_config(profileId?: string): Promise<ProfileConfig>;
  db_set_profile_config(profileId: string | null, partial: Partial<ProfileConfig>): Promise<ProfileConfig>;
}
