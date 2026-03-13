/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        mist: '#f5f5f4',
        line: '#e7e5e4',
      },
      boxShadow: {
        panel: '0 12px 40px -22px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};
