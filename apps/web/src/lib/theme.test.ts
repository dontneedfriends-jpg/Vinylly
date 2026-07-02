import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('theme store', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    const { useTheme } = await import('./theme');
    useTheme.getState().setMode('light');
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('initializes to light by default', async () => {
    const { useTheme } = await import('./theme');
    expect(useTheme.getState().mode).toBe('light');
  });

  it('persists and applies light theme', async () => {
    const { useTheme } = await import('./theme');
    useTheme.getState().setMode('light');
    expect(useTheme.getState().mode).toBe('light');
    expect(localStorage.getItem('vinylly:theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists and applies dark theme', async () => {
    const { useTheme } = await import('./theme');
    useTheme.getState().setMode('dark');
    expect(useTheme.getState().mode).toBe('dark');
    expect(localStorage.getItem('vinylly:theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('cycles between light and dark', async () => {
    const { useTheme } = await import('./theme');
    expect(useTheme.getState().mode).toBe('light');
    useTheme.getState().cycle();
    expect(useTheme.getState().mode).toBe('dark');
    useTheme.getState().cycle();
    expect(useTheme.getState().mode).toBe('light');
  });
});