import typography from '@tailwindcss/typography';
import { DUO_MEDIA_QUERY } from './src/lib/duoBreakpoint.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    screens: {
      sm: '640px',
      // Raw query from duoBreakpoint.js — excludes closed-phone landscape;
      // includes ≥1024 regardless of height. Sticky keyboard shell is JS-driven.
      duo: { raw: DUO_MEDIA_QUERY },
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
  ],
};
