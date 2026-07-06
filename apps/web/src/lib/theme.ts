import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  cycle(): void;
}

const STORAGE_KEY = 'vinylly:theme';
const DEFAULT_MODE: ThemeMode = 'auto';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
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
  const resolved = mode === 'auto' ? systemTheme() : mode;
  document.documentElement.setAttribute('data-theme', resolved);
  // data-mode stores the user's selection (incl. 'auto') so the cycle button reflects it
  document.documentElement.setAttribute('data-mode', mode);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? 'dark light' : 'light dark');
}

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
      const cur = get().mode;
      const resolved = cur === 'auto' ? systemTheme() : cur;
      const next: ThemeMode = resolved === 'light' ? 'dark' : 'light';
      get().setMode(next);
    },
  };
});

applyTheme(readStoredMode());

// Re-apply when the OS-level theme changes while in 'auto' mode
if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    if (useTheme.getState().mode === 'auto') applyTheme('auto');
  });
}