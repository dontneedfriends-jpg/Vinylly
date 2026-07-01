import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@vinylly/ui';
import { useTheme, type ThemeMode } from '../lib/theme';

const order: ThemeMode[] = ['light', 'dark', 'system'];

export function ThemeToggle() {
  const { t } = useTranslation();
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);

  const labels: Record<ThemeMode, string> = {
    light: t('layout:theme.light'),
    dark: t('layout:theme.dark'),
    system: t('layout:theme.system'),
  };

  const cycle = () => {
    const idx = order.indexOf(mode);
    const next = order[(idx + 1) % order.length] as ThemeMode;
    setMode(next);
  };

  return (
    <>
      <div className="hidden xl:block">
        <SegmentedControl
          ariaLabel={t('layout:theme.aria')}
          value={mode}
          onChange={(v) => setMode(v as ThemeMode)}
          options={order.map((m) => ({ value: m, label: labels[m] }))}
          size="sm"
          className="w-full"
        />
      </div>
      <button
        type="button"
        onClick={cycle}
        title={labels[mode]}
        aria-label={t('layout:theme.cycle_label', { mode: labels[mode] })}
        className="rounded-base bg-surface text-fg-body hover:text-fg-heading shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset border-border-default flex h-10 w-full items-center justify-center border transition-all duration-200 ease-in-out xl:hidden"
      >
        {mode === 'light' ? <SunIcon /> : mode === 'dark' ? <MoonIcon /> : <SystemIcon />}
      </button>
    </>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-5 w-5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66L4.93 19.07M19.07 4.93L17.66 6.34"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}
