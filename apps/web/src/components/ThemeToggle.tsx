import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeMode } from '../lib/theme';

const CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

export function ThemeToggle() {
  const { t } = useTranslation();
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);

  const labels: Record<ThemeMode, string> = {
    light: t('layout:theme.light'),
    dark: t('layout:theme.dark'),
    auto: t('layout:theme.auto'),
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('layout:theme.aria')}
      className="rounded-base bg-surface shadow-neu-inset grid w-full grid-cols-3 gap-0.5 p-1"
    >
      {CYCLE.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(m)}
            title={labels[m]}
            className={`flex items-center justify-center gap-1.5 rounded-base px-2.5 py-1.5 text-xs transition-all ${
              active
                ? 'bg-surface text-fg-heading shadow-neu-2xs font-medium'
                : 'text-fg-body-subtle hover:text-fg-body'
            }`}
          >
            <ThemeIcon mode={m} />
            <span className="hidden sm:inline">{labels[m]}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}
