/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '400px',
      },
      colors: {
        // Charcoal / graphite base
        graphite: {
          950: '#0a0c0e',
          900: '#0e1114',
          850: '#12161a',
          800: '#161b20',
          750: '#1a2026',
          700: '#212830',
          600: '#2a323b',
          500: '#364049',
          400: '#4a5662',
          300: '#6b7783',
          200: '#9aa5b1',
          100: '#c7cfd8',
        },
        // Gunmetal panels
        gunmetal: {
          950: '#111418',
          900: '#15191e',
          800: '#1b2026',
          700: '#222932',
          600: '#2b333d',
          500: '#38424e',
          400: '#4c5866',
        },
        // SpotVault gold
        gold: {
          50: '#fbf3d8',
          100: '#f5e6b0',
          200: '#ecd07e',
          300: '#e2b94c',
          400: '#d4a52c',
          500: '#c0911e',
          600: '#a3781a',
          700: '#835e17',
          800: '#5f4210',
          900: '#3d2b09',
        },
        steel: {
          50: '#e9edf1',
          100: '#d2d9e0',
          200: '#aab6c2',
          300: '#84929f',
          400: '#5f6e7c',
          500: '#475565',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        'vault-wide': '0.35em',
      },
      keyframes: {
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'spin-rev': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(-360deg)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'pulse-gold': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 20s linear infinite',
        'spin-rev': 'spin-rev 16s linear infinite',
        'fade-in': 'fade-in 0.5s ease forwards',
        'fade-out': 'fade-out 0.5s ease forwards',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};
