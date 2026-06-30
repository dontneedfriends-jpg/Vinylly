import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('initializes to system by default', async () => {
    const { useTheme } = await import('./theme');
    expect(useTheme.getState().mode).toBe('system');
  });

  it('persists and applies light theme', async () => {
    const { useTheme } = await import('./theme');
    useTheme.getState().setMode('light');
    expect(useTheme.getState().mode).toBe('light');
    expect(localStorage.getItem('vinylly:theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('cycles through modes', async () => {
    const { useTheme } = await import('./theme');
    const initial = useTheme.getState().mode;
    useTheme.getState().cycle();
    const after1 = useTheme.getState().mode;
    useTheme.getState().cycle();
    const after2 = useTheme.getState().mode;
    expect(after1).not.toBe(initial);
    expect(after2).not.toBe(after1);
  });
});
