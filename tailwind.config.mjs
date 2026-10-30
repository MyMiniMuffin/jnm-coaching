import typography from '@tailwindcss/typography';
import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
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
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
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
          DEFAULT: '#246568',
          hover: '#1B5053',
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
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
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
    // Same source as shellMode / useDesktop: html[data-shell="wide"].
    // Specificity beats sm:/md: media utilities when both match (e.g. sticky keyboard).
    // Note: stacked `lg:duo:` does not wrap in the lg media with this parent variant —
    // use `duo-lg:` when wide+≥1024 must override `duo:`.
    plugin(({ addVariant }) => {
      addVariant('duo', 'html[data-shell="wide"] &');
      addVariant('duo-lg', '@media (min-width: 1024px) { html[data-shell="wide"] & }');
    }),
  ],
};
