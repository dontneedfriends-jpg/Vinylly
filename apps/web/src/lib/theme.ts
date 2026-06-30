import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  cycle(): void;
}

const STORAGE_KEY = 'vinylly:theme';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemPrefersDark() ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? 'dark light' : 'light dark');
}

function persist(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

let initialized = false;
let mqListenerAttached = false;

function ensureSystemListener(): void {
  if (mqListenerAttached || typeof window === 'undefined' || !window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const { mode } = useTheme.getState();
    if (mode === 'system') applyTheme('system');
  };
  if (mq.addEventListener) {
    mq.addEventListener('change', handler);
  } else if (mq.addListener) {
    mq.addListener(handler);
  }
  mqListenerAttached = true;
}

export const useTheme = create<ThemeState>((set, get) => {
  const initial = readStoredMode();
  return {
    mode: initial,
    setMode(mode) {
      persist(mode);
      applyTheme(mode);
      ensureSystemListener();
      set({ mode });
    },
    cycle() {
      const order: ThemeMode[] = ['light', 'dark', 'system'];
      const cur = get().mode;
      const idx = order.indexOf(cur);
      const next = order[(idx + 1) % order.length] ?? 'system';
      get().setMode(next);
    },
  };
});

function initTheme(): void {
  if (initialized) return;
  initialized = true;
  const mode = readStoredMode();
  applyTheme(mode);
  ensureSystemListener();
}

initTheme();
