/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        jhs: { 50: '#FFF4EC', 100: '#FFE6D4', 200: '#FFC9A3', 300: '#FDA66C', 400: '#F88A45', 500: '#F37021', 600: '#DB5A0E', 700: '#B4460B', 800: '#8C3710', 900: '#712F10' },
        cielo: { 50: '#EDF8FD', 100: '#D4EFFA', 200: '#A6DDF4', 300: '#6EC8EC', 400: '#27AAE1', 500: '#1592C7', 600: '#1275A3', 700: '#135F84' },
        carbon: { 50: '#F4F6F7', 100: '#E3E8EA', 200: '#C7D0D4', 300: '#9AA8AE', 400: '#6B7C84', 500: '#4F6068', 600: '#37474F', 700: '#2B383F', 800: '#1F292E', 900: '#141B1F' },
        mort: { 50: '#FDEEEE', 100: '#FBD5D5', 500: '#E5484D', 600: '#CB3439', 700: '#A62A2E' },
        desc: { 50: '#FFF7E6', 100: '#FEEBC0', 500: '#F5A524', 600: '#D98A0B', 700: '#A86A06' },
        aba: { 50: '#EDF8EF', 100: '#D3EFD8', 500: '#3FA34D', 600: '#2F8A3C', 700: '#236B2E' },
        peso: { 50: '#EDF8FD', 100: '#D4EFFA', 500: '#27AAE1', 600: '#1592C7', 700: '#135F84' },
        amb: { 50: '#F3EFFE', 100: '#E4DBFD', 500: '#8E6CEF', 600: '#7652E0', 700: '#5B3CBB' },
        desp: { 50: '#E9FAF7', 100: '#C8F2EA', 500: '#14B8A6', 600: '#0E9888', 700: '#0B766A' },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(20,27,31,.06), 0 4px 16px rgba(20,27,31,.06)', pop: '0 10px 30px rgba(243,112,33,.25)' },
    },
  },
  plugins: [],
};
