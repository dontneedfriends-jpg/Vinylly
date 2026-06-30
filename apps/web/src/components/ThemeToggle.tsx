import { SegmentedControl } from '@vinylly/ui';
import { useTheme, type ThemeMode } from '../lib/theme';

const labels: Record<ThemeMode, string> = {
  light: 'Светлая',
  dark: 'Тёмная',
  system: 'Сист.',
};

const order: ThemeMode[] = ['light', 'dark', 'system'];

export function ThemeToggle() {
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);

  return (
    <SegmentedControl
      ariaLabel="Тема оформления"
      value={mode}
      onChange={(v) => setMode(v as ThemeMode)}
      options={order.map((m) => ({ value: m, label: labels[m] }))}
      size="sm"
      className="w-full"
    />
  );
}
