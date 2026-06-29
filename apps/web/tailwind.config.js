/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-sunken': 'var(--color-surface)',
        'fg-heading': 'var(--color-fg-heading)',
        'fg-body': 'var(--color-fg-body)',
        'fg-body-subtle': 'var(--color-fg-body-subtle)',
        'fg-brand': 'var(--color-fg-brand)',
        'fg-secondary': 'var(--color-fg-secondary)',
        'fg-disabled': 'var(--color-fg-disabled)',
        'border-default': 'var(--color-border-default)',
        'border-default-medium': 'var(--color-border-default-medium)',
        'border-default-strong': 'var(--color-border-default-strong)',
        'border-brand': 'var(--color-fg-brand)',
      },
      fontFamily: {
        sans: [
          '"Nunito Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
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
