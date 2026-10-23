import type { Config } from 'tailwindcss';

/**
 * Design tokens. Semantic tokens resolve through CSS variables so the same
 * utility classes work in light and dark mode without duplicating every style.
 */
export default <Config>{
  darkMode: 'class',
  content: [
    './app.vue',
    './components/**/*.{vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{ts,vue}',
    './middleware/**/*.ts',
    './plugins/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        rail: {
          DEFAULT: 'rgb(var(--rail) / <alpha-value>)',
          ink: 'rgb(var(--rail-ink) / <alpha-value>)',
          muted: 'rgb(var(--rail-muted) / <alpha-value>)',
          line: 'rgb(var(--rail-line) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        display: [
          '"Iowan Old Style"',
          '"Palatino Linotype"',
          'Palatino',
          '"Book Antiqua"',
          'Georgia',
          'serif',
        ],
        mono: ['"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.9rem' }],
        'display-sm': ['2.1rem', { lineHeight: '2.15rem', letterSpacing: '-0.035em' }],
        display: ['3.35rem', { lineHeight: '3.1rem', letterSpacing: '-0.045em' }],
        'display-lg': ['4.9rem', { lineHeight: '4.5rem', letterSpacing: '-0.055em' }],
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '4px',
      },
      boxShadow: {
        none: 'none',
        panel: '0 1px 0 0 rgb(var(--line))',
        lift: '0 18px 50px -24px rgb(0 0 0 / 0.35)',
      },
      letterSpacing: {
        caps: '0.16em',
        wide2: '0.08em',
      },
      maxWidth: {
        shell: '1560px',
      },
      screens: {
        xs: '420px',
      },
      transitionTimingFunction: {
        precise: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        'scan-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash-success': {
          '0%': { opacity: '0.9' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'scan-in': 'scan-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'flash-success': 'flash-success 700ms ease-out forwards',
      },
    },
  },
  plugins: [],
};
