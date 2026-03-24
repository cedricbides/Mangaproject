/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bebas Neue', 'cursive'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg:           'var(--bg)',
        surface:      'var(--surface)',
        card:         'var(--card)',
        border:       'var(--border)',
        primary:      '#e8394d',
        'primary-dim':'rgba(232,57,77,0.15)',
        'primary-glow':'rgba(232,57,77,0.35)',
        accent:       '#f5a623',
        'accent-dim': 'rgba(245,166,35,0.15)',
        muted:        'var(--muted)',
        text:         'var(--text)',
        'text-muted': 'var(--text-muted)',
      },
      backgroundColor: {
        dropdown: 'var(--dropdown-bg)',
      },
      backgroundImage: {
        'radial-hero': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(232,57,77,0.15), transparent)',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
  safelist: ['theme-dark', 'theme-dim', 'theme-light'],
}