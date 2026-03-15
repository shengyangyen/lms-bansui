import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 允許 LAN 存取（手機同 Wi-Fi 可連）
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        timeout: 5000,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[vite proxy]', err.message);
            if (res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '後端連線失敗，請確認 backend 已啟動 (npm run dev)' }));
            }
          });
        }
      }
    }
  }
})
