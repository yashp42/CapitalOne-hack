/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        'sans': ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2d5a3a',
          50: '#f0f7f2',
          100: '#dbeee1',
          200: '#b9ddc5',
          300: '#8dc4a0',
          400: '#5da376',
          500: '#2d5a3a',
          600: '#264d31',
          700: '#1f4029',
          800: '#1a3422',
          900: '#162b1d',
          950: '#0c170f',
        },
        secondary: {
          DEFAULT: '#c5ae8b',
          50: '#faf8f4',
          100: '#f4f0e7',
          200: '#e8ddc9',
          300: '#dac5a2',
          400: '#c5ae8b',
          500: '#b59670',
          600: '#a07d5c',
          700: '#86664c',
          800: '#6e5441',
          900: '#5a4537',
          950: '#32251c',
        },
        main: '#ffffff',
      },
    },
  },
  plugins: [],
}

