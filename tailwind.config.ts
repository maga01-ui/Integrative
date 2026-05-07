import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colore brand principale: rgb(90, 220, 180)
        brand: {
          DEFAULT: '#5ADCB4',
          hover: '#46BE9B',
        },
      },
    },
  },
  plugins: []
}

export default config
