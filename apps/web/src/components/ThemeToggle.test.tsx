import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('renders three segmented theme options', async () => {
    const { useTheme } = await import('../lib/theme');
    useTheme.getState().setMode('light');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /Светлая/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Тёмная/, pressed: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сист\./, pressed: false })).toBeInTheDocument();
  });

  it('marks the active theme as pressed', async () => {
    const { useTheme } = await import('../lib/theme');
    useTheme.getState().setMode('dark');
    render(<ThemeToggle />);
    const darkBtn = screen.getByRole('button', { name: /Тёмная/, pressed: true });
    expect(darkBtn.getAttribute('aria-pressed')).toBe('true');
  });
});
