import typography from '@tailwindcss/typography';
import plugin from 'tailwindcss/plugin';
import { DUO_MIN_WIDTH_PX } from './src/lib/duoBreakpoint.js';

/** @type {import('tailwindcss').Config} */
export default {
  // Safety net: any remaining bare `hover:` compiles to @media (hover: hover), so touch never gets sticky hover.
  future: { hoverOnlyWhenSupported: true },
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['Allo', 'system-ui', 'sans-serif'],
        display: ['Literata', 'Georgia', 'serif'],
      },
      colors: {
        surface: {
          50: '#F7F7F4',
          100: '#F1F0EC',
          200: '#E4E1DA',
          300: '#CCC7BC',
        },
        ink: {
          DEFAULT: '#171717',
          muted: '#525252',
          faint: '#8A847A',
        },
        accent: {
          DEFAULT: '#0E72B5',
          hover: '#0A578A',
        },
        report: {
          good: '#527062',
          medium: '#946C17',
          poor: '#AE4D48',
          training: '#526B85',
        },
        success: '#546B3E',
        warning: {
          DEFAULT: '#CA8A04',
          ink: '#854D0E',
        },
        error: '#DC2626',
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
        'spring-snappy': 'var(--ease-spring-snappy)',
        'out-expo': 'var(--ease-out-expo)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      // Entrances fill backwards only, so no transform or filter stays on the
      // element afterwards (a lingering transform would trap position: fixed).
      animation: {
        'fade-in': 'fadeIn var(--dur-base) var(--ease-out-expo) backwards',
        'slide-up': 'slideUp var(--dur-base) var(--ease-spring) backwards',
        'scale-in': 'scaleIn var(--dur-slow) var(--ease-spring) backwards',
        'sheet-up': 'sheetUp var(--dur-slow) var(--ease-out-expo) backwards',
        'toast-in': 'toastIn var(--dur-slow) var(--ease-spring) backwards',
        // Exits are quicker than entrances and hold their end state until unmount.
        'fade-out': 'fadeOut var(--dur-fast) var(--ease-out-expo) forwards',
        'scale-out': 'scaleOut var(--dur-fast) var(--ease-out-expo) forwards',
        'toast-out': 'toastOut var(--dur-fast) var(--ease-out-expo) forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)', filter: 'blur(4px)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96)', filter: 'blur(4px)' },
        },
        sheetUp: {
          from: { transform: 'translateY(100%)' },
        },
        fadeOut: {
          to: { opacity: '0' },
        },
        scaleOut: {
          to: { opacity: '0', transform: 'scale(0.97)', filter: 'blur(4px)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.96)', filter: 'blur(4px)' },
        },
        toastOut: {
          to: { opacity: '0', transform: 'translateY(4px) scale(0.96)', filter: 'blur(4px)' },
        },
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.ink.DEFAULT'),
            a: { color: theme('colors.ink.DEFAULT'), textDecoration: 'underline' },
            h1: { fontFamily: theme('fontFamily.display').join(', '), fontWeight: '400' },
            h2: { fontFamily: theme('fontFamily.display').join(', '), fontWeight: '400' },
            h3: { fontFamily: theme('fontFamily.display').join(', '), fontWeight: '400' },
            strong: { fontWeight: '600' },
          },
        },
      }),
    },
  },
  plugins: [
    typography,
    // Density utilities for wide sidebar, and for Duo rail only when width ≥ 700.
    // Closed Duo (390) stays phone density so cards are not squeezed. Specificity
    // beats sm:/md: when both match. Use `duo-lg:` for ≥1024 overrides
    // (stacked `lg:duo:` does not wrap in the lg media with this parent variant).
    plugin(({ addVariant }) => {
      addVariant('duo', [
        'html[data-shell="wide"] &',
        `@media (min-width: ${DUO_MIN_WIDTH_PX}px) { html[data-shell="rail"] & }`,
      ]);
      addVariant('duo-lg', `@media (min-width: 1024px) { :is(html[data-shell="wide"], html[data-shell="rail"]) & }`);
    }),
  ],
};
