/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // GitHub Dark Theme - EXACT colors from prototype
        'bg-primary': '#0d1117',
        'bg-secondary': '#010409',
        'bg-tertiary': '#161b22',
        'bg-elevated': '#21262d',
        'border': '#30363d',
        'text-primary': '#c9d1d9',
        'text-secondary': '#8b949e',
        'text-tertiary': '#6e7681',
        'text-placeholder': '#484f58',
        'accent-blue': '#58a6ff',
        'accent-purple': '#a371f7',
        'accent-green': '#3fb950',
        'accent-red': '#f85149',
        'accent-yellow': '#d29922',
        // Semantic colors
        'interactive': {
          DEFAULT: '#58a6ff',
          hover: '#79b8ff',
        },
        'success': {
          DEFAULT: '#3fb950',
          bg: 'rgba(63, 185, 80, 0.15)',
        },
        'warning': {
          DEFAULT: '#d29922',
          bg: 'rgba(210, 153, 34, 0.15)',
        },
        'danger': {
          DEFAULT: '#f85149',
          bg: 'rgba(248, 81, 73, 0.15)',
        },
        'info': {
          DEFAULT: '#58a6ff',
          bg: 'rgba(88, 166, 255, 0.15)',
        },
        'purple': {
          DEFAULT: '#a371f7',
          bg: 'rgba(163, 113, 247, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'tiny': '11px',
        'xs': '12px',
        'sm': '13px',
        'base': '14px',
        'md': '15px',
        'lg': '24px',
        'xl': '32px',
      },
      spacing: {
        '18': '4.5rem',
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'lg': '12px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(0, 0, 0, 0.2)',
        'DEFAULT': '0 8px 24px rgba(0, 0, 0, 0.3)',
        'lg': '0 20px 60px rgba(0, 0, 0, 0.5)',
      },
      transitionDuration: {
        'fast': '150ms',
        'DEFAULT': '200ms',
        'medium': '300ms',
      },
      backdropBlur: {
        'glass': '12px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
