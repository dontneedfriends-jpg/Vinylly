import { create } from 'zustand';
import type { ProfileRecord } from '@vinylly/host';

const STORAGE_KEY_PROFILES = 'vinylly:profiles';

const DEFAULT_PROFILE: ProfileRecord = {
  id: 'personal',
  label: 'Personal',
  createdAt: new Date().toISOString(),
};

export interface ProfileState {
  profiles: ProfileRecord[];
  activeId: string | null;
  /** True once the store has read profile index from the host. UI must wait. */
  ready: boolean;
  createProfile(label: string): Promise<ProfileRecord>;
  renameProfile(id: string, label: string): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  switchProfile(id: string): Promise<void>;
}

function readLocalProfiles(): { profiles: ProfileRecord[]; activeId: string | null } {
  if (typeof window === 'undefined') return { profiles: [], activeId: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (!raw) return { profiles: [], activeId: null };
    const parsed = JSON.parse(raw) as { profiles?: ProfileRecord[]; activeId?: string | null };
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
    };
  } catch {
    return { profiles: [], activeId: null };
  }
}

function persist(profiles: ProfileRecord[], activeId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify({ profiles, activeId }));
  } catch {
    /* quota or disabled — ignore */
  }
}

function genId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

interface TauriProfileApi {
  db_list_profiles?: () => Promise<{
    profiles: Array<{ id: string; label: string; created_at: string }>;
    active_id: string | null;
  }>;
  db_create_profile?: (
    label: string,
    set_active?: boolean,
  ) => Promise<{
    profile: { id: string; label: string; created_at: string };
    active_id: string | null;
  }>;
  db_rename_profile?: (id: string, label: string) => Promise<{
    id: string;
    label: string;
    created_at: string;
  }>;
  db_delete_profile?: (id: string) => Promise<void>;
  db_set_active_profile?: (id: string) => Promise<void>;
}

function getTauriApi(): TauriProfileApi | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: {
      invoke?: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  };
  const internals = w.__TAURI_INTERNALS__;
  if (!internals || typeof internals.invoke !== 'function') return null;
  const invoke = internals.invoke.bind(internals);
  return {
    db_list_profiles: () => invoke('db_list_profiles', {}),
    db_create_profile: (label, set_active) =>
      invoke('db_create_profile', { label, setActive: set_active ?? true }),
    db_rename_profile: (id, label) => invoke('db_rename_profile', { id, label }),
    db_delete_profile: (id) => invoke('db_delete_profile', { id }),
    db_set_active_profile: (id) => invoke('db_set_active_profile', { id }),
  };
}

function normalizeTauriProfiles(
  list: Array<{ id: string; label: string; created_at: string }>,
): ProfileRecord[] {
  return list.map((p) => ({ id: p.id, label: p.label, createdAt: p.created_at }));
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeId: null,
  ready: false,

  async createProfile(label) {
    const trimmed = label.trim();
    if (!trimmed) throw new Error('Profile label is empty');
    const tauri = getTauriApi();
    let next: ProfileRecord;
    let nextActive: string | null;
    if (tauri?.db_create_profile) {
      const r = await tauri.db_create_profile(trimmed, true);
      next = { id: r.profile.id, label: r.profile.label, createdAt: r.profile.created_at };
      nextActive = r.active_id ?? next.id;
    } else {
      next = { id: genId(), label: trimmed, createdAt: new Date().toISOString() };
      const list = [...get().profiles, next];
      nextActive = next.id;
      persist(list, nextActive);
    }
    set({ profiles: [...get().profiles, next], activeId: nextActive });
    return next;
  },

  async renameProfile(id, label) {
    const trimmed = label.trim();
    if (!trimmed) throw new Error('Profile label is empty');
    const tauri = getTauriApi();
    if (tauri?.db_rename_profile) {
      await tauri.db_rename_profile(id, trimmed);
    }
    const next = get().profiles.map((p) => (p.id === id ? { ...p, label: trimmed } : p));
    persist(next, get().activeId);
    set({ profiles: next });
  },

  async deleteProfile(id) {
    if (get().profiles.length <= 1) throw new Error('Cannot delete the last profile');
    const tauri = getTauriApi();
    if (tauri?.db_delete_profile) await tauri.db_delete_profile(id);
    const nextList = get().profiles.filter((p) => p.id !== id);
    let nextActive = get().activeId;
    if (nextActive === id) {
      nextActive = nextList[0]?.id ?? null;
      if (tauri?.db_set_active_profile && nextActive) {
        await tauri.db_set_active_profile(nextActive);
      }
    }
    persist(nextList, nextActive);
    set({ profiles: nextList, activeId: nextActive });
  },

  async switchProfile(id) {
    if (!get().profiles.some((p) => p.id === id)) {
      throw new Error(`Profile not found: ${id}`);
    }
    const tauri = getTauriApi();
    if (tauri?.db_set_active_profile) await tauri.db_set_active_profile(id);
    persist(get().profiles, id);
    set({ activeId: id });
  },
}));

/**
 * Bootstrap profiles from host (Tauri) or local storage (Web).
 * Migrates legacy single-collection layout into a single "Personal" profile.
 * Idempotent: calling twice is safe. Wraps the Tauri path in a 3 s timeout
 * so a stuck Rust command cannot freeze the UI forever; on timeout we
 * fall back to the local profile store as if Tauri weren't there.
 */
export async function initProfiles(): Promise<{ profiles: ProfileRecord[]; activeId: string | null }> {
  try {
    return await Promise.race([initProfilesInner(), timeoutAfter(3000, 'initProfiles')]);
  } catch (err) {
    console.warn('[initProfiles] timed out or threw, falling back to local store', err);
    return ensureLocalProfile();
  }
}

function timeoutAfter(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label}: timed out after ${ms}ms`)), ms);
  });
}

function ensureLocalProfile(): { profiles: ProfileRecord[]; activeId: string | null } {
  if (useProfileStore.getState().ready) {
    return {
      profiles: useProfileStore.getState().profiles,
      activeId: useProfileStore.getState().activeId,
    };
  }
  const local = readLocalProfiles();
  if (local.profiles.length === 0) {
    const initial: ProfileRecord = { ...DEFAULT_PROFILE };
    persist([initial], initial.id);
    useProfileStore.setState({ profiles: [initial], activeId: initial.id, ready: true });
    return { profiles: [initial], activeId: initial.id };
  }
  useProfileStore.setState({
    profiles: local.profiles,
    activeId: local.activeId ?? local.profiles[0]?.id ?? null,
    ready: true,
  });
  return {
    profiles: local.profiles,
    activeId: local.activeId ?? local.profiles[0]?.id ?? null,
  };
}

async function initProfilesInner(): Promise<{ profiles: ProfileRecord[]; activeId: string | null }> {
  if (useProfileStore.getState().ready) {
    return {
      profiles: useProfileStore.getState().profiles,
      activeId: useProfileStore.getState().activeId,
    };
  }

  const tauri = getTauriApi();
  if (tauri && tauri.db_list_profiles && tauri.db_create_profile) {
    const r = await tauri.db_list_profiles();
    const profiles = normalizeTauriProfiles(r.profiles ?? []);
    let activeId = r.active_id ?? profiles[0]?.id ?? null;
    if (profiles.length === 0) {
      const created = await tauri.db_create_profile(DEFAULT_PROFILE.label, true);
      profiles.push({
        id: created.profile.id,
        label: created.profile.label,
        createdAt: created.profile.created_at,
      });
      activeId = created.active_id ?? created.profile.id;
    }
    persist(profiles, activeId);
    useProfileStore.setState({ profiles, activeId, ready: true });
    return { profiles, activeId };
  }

  // No Tauri bridge present — fall through to the local profile store.
  return ensureLocalProfile();
}
