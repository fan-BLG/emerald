import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Emerald Green (Gamma Doppler inspired)
        emerald: {
          glow: '#00FF7F',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Dark theme backgrounds
        dark: {
          base: '#0D0D0D',
          card: '#141414',
          hover: '#1A1A1A',
          border: '#242424',
          muted: '#333333',
          lighter: '#404040',
        },
        // Accent colors
        gold: '#FFD700',
        lose: '#FF4757',
        win: '#00FF7F',
        // CS2 Rarity colors
        rarity: {
          consumer: '#b0c3d9',
          industrial: '#5e98d9',
          milspec: '#4b69ff',
          restricted: '#8847ff',
          classified: '#d32ce6',
          covert: '#eb4b4b',
          contraband: '#e4ae39',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'emerald-glow': '0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.2)',
        'emerald-glow-lg': '0 0 30px rgba(16, 185, 129, 0.5), 0 0 60px rgba(16, 185, 129, 0.3)',
        'gold-glow': '0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.2)',
      },
      animation: {
        'pulse-emerald': 'pulse-emerald 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounce-subtle 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-emerald': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
