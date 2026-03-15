#!/usr/bin/env node
/**
 * Health check 測試腳本
 * 1. 直接打後端 3001 確認 backend 是否運行
 * 2. 打前端 proxy 3000 確認 proxy 是否正確轉發
 */
import http from 'http';

const BACKEND_URL = 'http://127.0.0.1:3001/api/health';
const PROXY_URL = 'http://127.0.0.1:3000/api/health';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: data || null });
        }
      });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
  });
}

async function main() {
  console.log('=== Health Check 測試 ===\n');

  // 1. 直接打後端
  try {
    const r = await fetch(BACKEND_URL);
    if (r.status === 200 && r.data?.ok) {
      console.log('✅ 後端 (3001) 正常:', r.data);
    } else {
      console.log('⚠️ 後端回傳異常:', r);
    }
  } catch (e) {
    console.log('❌ 後端 (3001) 連線失敗:', e.message);
    console.log('   → 請先執行: cd backend && npm run dev\n');
    process.exit(1);
  }

  // 2. 打 proxy
  try {
    const r = await fetch(PROXY_URL);
    if (r.status === 200 && r.data?.ok) {
      console.log('✅ Proxy (3000→3001) 正常:', r.data);
    } else {
      console.log('⚠️ Proxy 回傳異常:', r);
    }
  } catch (e) {
    console.log('❌ Proxy (3000) 連線失敗:', e.message);
    console.log('   → 請確認 frontend 已啟動: cd frontend && npm run dev');
    console.log('   → 若後端已啟動，可能是 proxy 設定問題\n');
    process.exit(1);
  }

  console.log('\n✅ 所有 health check 通過');
}

main();
