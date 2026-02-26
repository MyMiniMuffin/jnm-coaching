/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
      },
      colors: {
        surface: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
        },
        ink: {
          DEFAULT: '#171717',
          muted: '#525252',
          faint: '#A3A3A3',
        },
        accent: {
          DEFAULT: '#171717',
          hover: '#262626',
        },
        success: '#16A34A',
        warning: '#CA8A04',
        error: '#DC2626',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
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
    require('@tailwindcss/typography'),
  ],
};
