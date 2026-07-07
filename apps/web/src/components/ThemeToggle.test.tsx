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

  it('renders all three theme options as a radiogroup', async () => {
    const { useTheme } = await import('../lib/theme');
    useTheme.getState().setMode('light');
    render(<ThemeToggle />);
    expect(screen.getByRole('radiogroup', { name: /Тема/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Светлая/, checked: true })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Тёмная/, checked: false })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Авто/, checked: false })).toBeInTheDocument();
  });

  it('marks the active theme as checked', async () => {
    const { useTheme } = await import('../lib/theme');
    useTheme.getState().setMode('dark');
    render(<ThemeToggle />);
    const darkBtn = screen.getByRole('radio', { name: /Тёмная/, checked: true });
    expect(darkBtn.getAttribute('aria-checked')).toBe('true');
  });
});