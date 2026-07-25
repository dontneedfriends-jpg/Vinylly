import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { resetHostShell, setHostShell } from '@vinylly/host';
import type { HostShell, HostNet } from '@vinylly/host';
import { useSettings } from './settings-store';

// Mock @vinylly/db so profile-settings helpers and the Prisma binding
// are controllable from the test. Both getProfileSettings and the
// profileSettings.upsert path read from these spies.
type ProfileSettingsRow = { id: string; data: Record<string, unknown> };
type UpsertArgs = {
  where?: { id?: string };
  create?: { id?: string; data?: Record<string, unknown> };
  update?: { data?: Record<string, unknown> };
};

const profileSettingsMock = {
  findFirst: vi.fn<[], Promise<ProfileSettingsRow | null>>(async () => null),
  upsert: vi.fn<[UpsertArgs | undefined], Promise<ProfileSettingsRow>>(async (args) => ({
    id: args?.where?.id ?? 'singleton',
    data: args?.update?.data ?? args?.create?.data ?? {},
  })),
};

const findFirstMock: Mock<[], Promise<ProfileSettingsRow | null>> = profileSettingsMock.findFirst;
const upsertMock: Mock<[UpsertArgs | undefined], Promise<ProfileSettingsRow>> = profileSettingsMock.upsert;

vi.mock('@vinylly/db', async () => {
  return {
    setPrismaClient: vi.fn(),
    setActivePrismaProfile: vi.fn(),
    getProfileSettings: vi.fn(async () => {
      const row = await profileSettingsMock.findFirst();
      return {
        discogsToken: '',
        discogsUsername: '',
        discogsSyncEnabled: true,
        ...(row?.data ?? {}),
      };
    }),
    setProfileSettings: vi.fn(async (next: Record<string, unknown>) => {
      await upsertMock({
        where: { id: 'singleton' },
        create: { id: 'singleton', data: next },
        update: { data: next },
      });
      return { discogsToken: '', discogsUsername: '', discogsSyncEnabled: true, ...next };
    }),
  };
});

function createMockShell(files: Record<string, string> = {}): HostShell {
  const store = { ...files };
  const fs = {
    readText: async (path: string) => {
      if (!(path in store)) throw new Error(`not found: ${path}`);
      return store[path] as string;
    },
    writeText: async (path: string, contents: string) => {
      store[path] = contents;
    },
    readBinary: async () => new Uint8Array(),
    writeBinary: async () => undefined,
    exists: async (path: string) => path in store,
    ensureDir: async () => undefined,
    remove: async (path: string) => {
      delete store[path];
    },
    list: async () => [],
    join: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
  };
  const net: HostNet = {
    fetchJson: async <T>(): Promise<T> => ({}) as T,
    fetchBinary: async () => new Uint8Array(),
  };
  return {
    paths: () => ({
      dataDir: '/data',
      coversDir: '/data/covers',
      dbFile: '/data/db.json',
      cacheDir: '/data/cache',
    }),
    fs: () => fs as HostShell['fs'] extends () => infer F ? F : never,
    net: () => net,
    openUrl: async () => {},
    isPortable: () => false,
    platform: () => 'linux',
  };
}

function resetState() {
  localStorage.clear();
  resetHostShell();
  findFirstMock.mockReset();
  findFirstMock.mockResolvedValue(null);
  upsertMock.mockReset();
  upsertMock.mockResolvedValue({ id: 'singleton', data: {} });
  useSettings.setState({
    discogsToken: '',
    discogsUsername: '',
    discogsSyncEnabled: true,
    onboardingDone: false,
    ready: false,
  });
}

describe('settings store (profile-scoped)', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('setDiscogsToken persists to in-memory store', async () => {
    await useSettings.getState().setDiscogsToken('my-token');
    expect(useSettings.getState().discogsToken).toBe('my-token');
  });

  it('trims whitespace from token', async () => {
    await useSettings.getState().setDiscogsToken('  spaced-token  ');
    expect(useSettings.getState().discogsToken).toBe('spaced-token');
  });

  it('clearDiscogsToken resets token, username and sync flag', async () => {
    useSettings.setState({
      discogsToken: 'old',
      discogsUsername: 'who',
      discogsSyncEnabled: false,
    });
    await useSettings.getState().clearDiscogsToken();
    const s = useSettings.getState();
    expect(s.discogsToken).toBe('');
    expect(s.discogsUsername).toBe('');
    expect(s.discogsSyncEnabled).toBe(true);
  });

  it('reload reads persisted profile settings', async () => {
    findFirstMock.mockResolvedValueOnce({
      id: 'singleton',
      data: {
        discogsToken: 'persisted',
        discogsUsername: 'me',
        discogsSyncEnabled: false,
      },
    });
    await useSettings.getState().reload();
    expect(useSettings.getState().discogsToken).toBe('persisted');
    expect(useSettings.getState().discogsUsername).toBe('me');
    expect(useSettings.getState().discogsSyncEnabled).toBe(false);
  });
});

describe('settings store — onboarding (global)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetHostShell();
    useSettings.setState({
      discogsToken: '',
      discogsUsername: '',
      discogsSyncEnabled: true,
      onboardingDone: false,
      ready: false,
    });
  });

  it('setOnboardingDone persists to localStorage', () => {
    useSettings.getState().setOnboardingDone();
    expect(useSettings.getState().onboardingDone).toBe(true);
    expect(localStorage.getItem('vinylly:onboarding-done')).toBe('true');
  });

  it('writes onboardingDone to host config.json when host shell is set', async () => {
    setHostShell(createMockShell());
    useSettings.getState().setOnboardingDone();
    await Promise.resolve();
    await Promise.resolve();
    const shell = await import('@vinylly/host').then((m) => m.tryGetHostShell());
    expect(shell).toBeDefined();
    const text = await shell!.fs().readText('/data/config.json');
    expect(JSON.parse(text)).toEqual({ onboardingDone: true });
  });
});
