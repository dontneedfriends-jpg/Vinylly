import { create } from 'zustand';
import i18n from './i18n';

const STORAGE_KEY = 'vinylly:locale';

interface LocaleState {
  locale: string;
  setLocale(locale: string): void;
}

function detectInitialLocale(): string {
  if (typeof window === 'undefined') return 'ru';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ru' || stored === 'en') return stored;
  } catch {}
  const nav = navigator.language?.slice(0, 2);
  if (nav === 'ru' || nav === 'en') return nav;
  return 'ru';
}

export const useLocale = create<LocaleState>((set) => ({
  locale: detectInitialLocale(),
  setLocale(locale) {
    set({ locale });
    void i18n.changeLanguage(locale);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {}
    }
    document.documentElement.dir = 'ltr';
  },
}));
