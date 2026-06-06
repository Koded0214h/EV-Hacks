/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          600: '#16a34a',
          700: '#15803d',
        },
        ink: {
          DEFAULT: '#0F172A',
          body:    '#475569',
          muted:   '#94A3B8',
        },
        surface: {
          bg:   '#F8FAFC',
          card: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E2E8F0',
          strong:  '#CBD5E1',
        },
        amber: {
          DEFAULT: '#D97706',
          light:   '#FEF3C7',
        },
        danger: {
          DEFAULT: '#DC2626',
          light:   '#FEF2F2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
