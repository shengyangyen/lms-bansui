import axios from 'axios';
import { useStore } from './store';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 90000 // 90 秒，配合 Render Free 冷啟動（約 50 秒）
});

api.interceptors.request.use((config) => {
  const token = useStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - 處理 401 (token 失效)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 失效或無效，自動登出
      useStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** 帶 token 的 fetch，用於下載等需認證的請求 */
export function fetchWithAuth(url, options = {}) {
  const token = useStore.getState().token;
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

export default api;
