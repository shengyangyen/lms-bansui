export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#609ea3',
          light: '#e8f2f4',
          dark: '#4a7d82',
        },
        sky: {
          light: '#e8f2f4',
          lighter: '#f0f7f8',
        }
      },
      fontFamily: {
        heading: "'Inter', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
        body: "'Inter', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
      },
      boxShadow: {
        light: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [
    function({ addComponents, theme }) {
      addComponents({
        /* 自動舊色彩轉換 */
        '.bg-blue-500': { backgroundColor: '#609ea3' },
        '.bg-blue-600': { backgroundColor: '#4a7d82' },
        '.text-blue-500': { color: '#609ea3' },
        '.text-blue-600': { color: '#4a7d82' },
        '.text-blue-700': { color: '#4a7d82' },
        '.border-blue-500': { borderColor: '#609ea3' },
        '.border-blue-600': { borderColor: '#4a7d82' },
        '.hover\\:bg-blue-500:hover': { backgroundColor: '#609ea3' },
        '.hover\\:bg-blue-600:hover': { backgroundColor: '#4a7d82' },
        '.hover\\:text-blue-600:hover': { color: '#4a7d82' },
        '.hover\\:text-blue-700:hover': { color: '#4a7d82' },
        '.focus\\:ring-blue-500:focus': { boxShadow: '0 0 0 3px rgba(96, 158, 163, 0.5)' },
        '.ring-blue-500': { boxShadow: '0 0 0 3px rgba(96, 158, 163, 0.5)' },
      });
    }
  ],
}
