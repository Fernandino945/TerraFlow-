/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        soil: {
          50: '#f5f0e8',
          100: '#e8dcc8',
          200: '#d4bc98',
          300: '#b89468',
          400: '#9a7248',
          500: '#7a5530',
          600: '#5e3f22',
          700: '#432d18',
          800: '#2d1e10',
          900: '#1a110a',
        },
        leaf: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        water: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
