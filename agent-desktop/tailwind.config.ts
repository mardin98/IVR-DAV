import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      colors: {
        surface: {
          0: '#060810',
          1: '#0c1020',
          2: '#111827',
          3: '#1a2335',
        },
        border: {
          DEFAULT: '#1e2d45',
          2: '#243352',
        },
        accent: {
          cyan: '#00e5ff',
          blue: '#3b82f6',
          green: '#10d98a',
          orange: '#f97316',
          red: '#f43f5e',
          amber: '#fbbf24',
        },
        text: {
          DEFAULT: '#e2eaf4',
          mid: '#8899b4',
          dim: '#3d5170',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ring': 'ring 1s ease-in-out infinite',
        'fade-in': 'fadeIn .25s ease-out',
        'slide-up': 'slideUp .3s ease-out',
      },
      keyframes: {
        ring: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '.8' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
