/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        bg: {
          900: 'rgb(var(--bg-900) / <alpha-value>)',
          800: 'rgb(var(--bg-800) / <alpha-value>)',
          700: 'rgb(var(--bg-700) / <alpha-value>)',
          600: 'rgb(var(--bg-600) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
        },
        cmr: 'rgb(var(--cmr) / <alpha-value>)',
        accent: {
          green: 'rgb(var(--accent-green) / <alpha-value>)',
          yellow: 'rgb(var(--accent-yellow) / <alpha-value>)',
          red: 'rgb(var(--accent-red) / <alpha-value>)',
          blue: 'rgb(var(--accent-blue) / <alpha-value>)',
          violet: 'rgb(var(--accent-violet) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
