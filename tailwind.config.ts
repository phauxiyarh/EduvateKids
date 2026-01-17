import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7c3aed',
        primaryDark: '#5b21b6',
        secondary: '#ec4899',
        accentOne: '#f59e0b',
        accentTwo: '#10b981',
        accentThree: '#3b82f6',
        ink: '#1f2937',
        muted: '#6b7280',
        cream: '#fff7ed'
      },
      fontFamily: {
        display: ['"Quicksand"', '"Nunito"', '"Alegreya Sans"', 'sans-serif'],
        body: ['"Mulish"', '"Alegreya Sans"', '"Nunito"', 'sans-serif']
      },
      boxShadow: {
        soft: '0 24px 60px rgba(31, 41, 55, 0.15)'
      },
      borderRadius: {
        xl: '28px'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}

export default config
