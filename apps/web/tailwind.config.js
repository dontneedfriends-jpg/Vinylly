/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',

        // Foreground
        'fg-heading': 'var(--color-fg-heading)',
        'fg-body': 'var(--color-fg-body)',
        'fg-body-subtle': 'var(--color-fg-body-subtle)',
        'fg-brand': 'var(--color-fg-brand)',
        'fg-brand-strong': 'var(--color-fg-brand-strong)',
        'fg-secondary': 'var(--color-fg-secondary)',
        'fg-disabled': 'var(--color-fg-disabled)',
        'fg-danger': 'var(--color-fg-danger)',
        'fg-danger-strong': 'var(--color-fg-danger-strong)',
        'fg-success': 'var(--color-fg-success)',
        'fg-success-strong': 'var(--color-fg-success-strong)',
        'fg-warning': 'var(--color-fg-warning)',

        // Semantic soft backgrounds (badges, alerts)
        'brand-softer': 'var(--color-brand-softer)',
        'brand-soft': 'var(--color-brand-soft)',
        'danger-soft': 'var(--color-danger-soft)',
        'success-soft': 'var(--color-success-soft)',
        'warning-soft': 'var(--color-warning-soft)',
        'secondary-soft': 'var(--color-secondary-soft)',

        // Borders
        'border-default': 'var(--color-border-default)',
        'border-default-medium': 'var(--color-border-default-medium)',
        'border-default-strong': 'var(--color-border-default-strong)',
        'border-brand': 'var(--color-border-brand)',
        'border-brand-subtle': 'var(--color-border-brand-subtle)',
        'border-danger-subtle': 'var(--color-border-danger-subtle)',
        'border-success-subtle': 'var(--color-border-success-subtle)',
        'border-warning-subtle': 'var(--color-border-warning-subtle)',
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        base: '8px',
        DEFAULT: '6px',
        sm: '2px',
        full: '9999px',
      },
      boxShadow: {
        'neu-2xs': 'var(--shadow-2xs)',
        'neu-xs': 'var(--shadow-xs)',
        'neu-sm': 'var(--shadow-sm)',
        'neu-md': 'var(--shadow-md)',
        'neu-lg': 'var(--shadow-lg)',
        'neu-xl': 'var(--shadow-xl)',
        'neu-2xl': 'var(--shadow-2xl)',
        'neu-inset': 'var(--shadow-inset)',
      },
      spacing: {
        4.5: '18px',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
};
