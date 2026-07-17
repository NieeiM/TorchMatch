/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101218',
        paper: '#f4f1e9',
        ember: '#ee4c2c',
        sage: '#c8ff62',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: { panel: '0 18px 60px rgba(16,18,24,.12)' },
    },
  },
  plugins: [],
}

