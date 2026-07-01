import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetHostShell, setHostShell, tryGetHostShell } from '@vinylly/host';
import type { HostShell, HostFs, HostNet } from '@vinylly/host';
import { useSettings, initSettings } from './settings-store';

function createMockShell(files: Record<string, string> = {}): HostShell {
  const store = { ...files };
  const fs: HostFs = {
    readText: async (path) => {
      if (!(path in store)) throw new Error(`not found: ${path}`);
      return store[path] as string;
    },
    writeText: async (path, contents) => {
      store[path] = contents;
    },
    readBinary: async () => new Uint8Array(),
    writeBinary: async () => undefined,
    exists: async (path) => path in store,
    ensureDir: async () => undefined,
    remove: async (path) => {
      delete store[path];
    },
    list: async () => [],
    join: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
  };
  const net: HostNet = {
    fetchJson: async <T>(): Promise<T> => ({}) as T,
    fetchBinary: async () => new Uint8Array(),
  };
  return {
    paths: () => ({
      dataDir: '/data',
      coversDir: '/data/covers',
      dbFile: '/data/db.sqlite',
      cacheDir: '/data/cache',
    }),
    fs: () => fs,
    net: () => net,
    openUrl: async () => {},
    isPortable: () => false,
    platform: () => 'linux',
  };
}

function resetState() {
  localStorage.clear();
  resetHostShell();
  useSettings.setState({ discogsToken: '', _initialized: false });
}

describe('settings store', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('persists token to localStorage on set', async () => {
    await useSettings.getState().setDiscogsToken('my-token');
    expect(useSettings.getState().discogsToken).toBe('my-token');
    expect(localStorage.getItem('vinylly:discogs-token')).toBe('my-token');
  });

  it('trims whitespace from token', async () => {
    await useSettings.getState().setDiscogsToken('  spaced-token  ');
    expect(useSettings.getState().discogsToken).toBe('spaced-token');
  });

  it('clears token via clearDiscogsToken', async () => {
    localStorage.setItem('vinylly:discogs-token', 'old');
    useSettings.setState({ discogsToken: 'old' });
    await useSettings.getState().clearDiscogsToken();
    expect(useSettings.getState().discogsToken).toBe('');
    expect(localStorage.getItem('vinylly:discogs-token')).toBeNull();
  });

  it('writes token to host config.json when host shell is set', async () => {
    setHostShell(createMockShell());
    await useSettings.getState().setDiscogsToken('host-token');
    const shell = tryGetHostShell();
    const text = await shell!.fs().readText('/data/config.json');
    expect(JSON.parse(text)).toEqual({ discogsToken: 'host-token' });
  });

  it('initSettings prefers host config over localStorage', async () => {
    localStorage.setItem('vinylly:discogs-token', 'local');
    setHostShell(createMockShell({ '/data/config.json': '{"discogsToken":"host"}' }));
    await initSettings();
    expect(useSettings.getState().discogsToken).toBe('host');
    expect(localStorage.getItem('vinylly:discogs-token')).toBe('host');
  });

  it('initSettings keeps localStorage when host has no config', async () => {
    localStorage.setItem('vinylly:discogs-token', 'local');
    setHostShell(createMockShell());
    await initSettings();
    expect(useSettings.getState().discogsToken).toBe('local');
  });

  it('initSettings is idempotent', async () => {
    setHostShell(createMockShell({ '/data/config.json': '{"discogsToken":"first"}' }));
    await initSettings();
    expect(useSettings.getState().discogsToken).toBe('first');
    // Change the file directly; the second init call should not re-read
    const shell = tryGetHostShell()!;
    await shell.fs().writeText('/data/config.json', '{"discogsToken":"second"}');
    await initSettings();
    expect(useSettings.getState().discogsToken).toBe('first');
  });
});
