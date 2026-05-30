import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Slate-based dark surface palette
        surface: {
          DEFAULT: '#0f172a', // app background
          card: '#1e293b', // cards
          raised: '#334155', // inputs / raised
        },
        brand: {
          DEFAULT: '#22c55e', // primary action (green = "go/lift")
          dark: '#16a34a',
          light: '#4ade80',
        },
        accent: '#38bdf8',
        danger: '#ef4444',
        warn: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // gym-friendly large touch target
        touch: '3.5rem', // 56px
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
