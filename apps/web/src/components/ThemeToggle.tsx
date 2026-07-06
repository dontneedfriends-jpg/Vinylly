import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@vinylly/ui';
import { useTheme, type ThemeMode } from '../lib/theme';

const order: ThemeMode[] = ['light', 'dark', 'auto'];

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
    <SegmentedControl
      ariaLabel={t('layout:theme.aria')}
      value={mode}
      onChange={(v) => setMode(v as ThemeMode)}
      options={order.map((m) => ({ value: m, label: labels[m] }))}
      size="sm"
      className="w-full"
    />
  );
}


