// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      colors: {
        'brand-blue': {
          DEFAULT: '#1A3C8F',
          50: '#EEF2FB',
          100: '#D5DFEF',
          200: '#ABBFDF',
          300: '#7E9FCF',
          400: '#5080BF',
          500: '#1A3C8F',
          600: '#163480',
          700: '#112A6A',
          800: '#0D2154',
          900: '#081844',
        },
        'brand-orange': {
          DEFAULT: '#F4821E',
          50: '#FEF4E9',
          100: '#FDDCB8',
          200: '#FCC589',
          300: '#F9AC5A',
          400: '#F7962E',
          500: '#F4821E',
          600: '#D9721A',
          700: '#B55E14',
          800: '#914B10',
          900: '#6E380C',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 2px 16px rgba(26, 60, 143, 0.08)',
        'card-hover': '0 8px 30px rgba(26, 60, 143, 0.15)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.4s ease-out',
        'slideUp': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },

  plugins: [],
};