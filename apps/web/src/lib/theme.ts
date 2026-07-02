import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  cycle(): void;
}

const STORAGE_KEY = 'vinylly:theme';
const DEFAULT_MODE: ThemeMode = 'light';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  return DEFAULT_MODE;
}

function persist(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', mode === 'dark' ? 'dark light' : 'light dark');
}

export const useTheme = create<ThemeState>((set, get) => {
  const initial = readStoredMode();
  return {
    mode: initial,
    setMode(mode) {
      persist(mode);
      applyTheme(mode);
      set({ mode });
    },
    cycle() {
      get().setMode(get().mode === 'light' ? 'dark' : 'light');
    },
  };
});

applyTheme(readStoredMode());