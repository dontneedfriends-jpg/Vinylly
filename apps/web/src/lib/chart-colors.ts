import { useMemo } from 'react';
import { useTheme } from './theme';

const LIGHT = ['#0F62FE', '#FA4D56', '#24A148', '#8A3FFC', '#009C98', '#F1C21B', '#FF832B', '#1192E8'];
const DARK = ['#4589FF', '#FF8389', '#42BE65', '#BE95FF', '#3DDBD9', '#F1C21B', '#FF9D57', '#33B1FF'];

const BRAND_LIGHT = { r: 15, g: 98, b: 254 };
const BRAND_DARK = { r: 69, g: 137, b: 255 };

export interface ChartColors {
  palette: string[];
  brand(alpha: number): string;
  track: string;
}

function resolvedTheme(mode: string): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function useChartColors(): ChartColors {
  const mode = useTheme((s) => s.mode);
  return useMemo(() => {
    const dark = resolvedTheme(mode) === 'dark';
    const brand = dark ? BRAND_DARK : BRAND_LIGHT;
    return {
      palette: dark ? DARK : LIGHT,
      brand: (alpha: number) => `rgba(${brand.r},${brand.g},${brand.b},${alpha})`,
      track: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    };
  }, [mode]);
}
