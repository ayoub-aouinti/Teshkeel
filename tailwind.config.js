/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Amiri', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold: {
          400: '#d4af37',
          500: '#c19a2e',
          600: '#a67c25',
        },
        navy: {
          800: '#1a1a2e',
          900: '#0f0f1a',
        },
      },
      lineHeight: {
        arabic: '3.5',
      },
    },
  },
  plugins: [],
}
