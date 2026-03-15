import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store';
import api from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setToken } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      setUser(data.user);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || (err.code === 'ERR_NETWORK' ? '無法連線，請確認前後端已啟動' : err.message || '登入失敗');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-light via-sky-lighter to-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* 飛航主題背景裝飾 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-40 h-40 rounded-full bg-primary/5 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        {/* 卡片 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
          {/* 標題 */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-heading text-xl sm:text-3xl font-bold text-primary mb-2">中華益師益友協會</h1>
            <p className="font-body text-sm text-gray-500">伴飛計畫 2026</p>
          </div>

          {/* 錯誤提示 */}
          {error && (
            <div className="alert-error mb-6">
              {error}
            </div>
          )}

          {/* 登入表單 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body block text-sm text-gray-700 mb-2">
                電子郵件
              </label>
              <input
                type="email"
                placeholder="你的信箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="font-body block text-sm text-gray-700 mb-2">
                密碼
              </label>
              <input
                type="password"
                placeholder="輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>

            {/* 登入按鈕 - 外框設計 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 px-4 mt-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? '登入中...' : '登入'}
            </button>
          </form>

          {/* 註冊連結 */}
          <p className="font-body text-center text-sm text-gray-600 mt-6">
            還沒有帳號？{' '}
            <Link to="/register" className="text-primary hover:text-primary-dark font-semibold transition">
              立即註冊
            </Link>
          </p>
        </div>

        {/* 底部說明 */}
        <p className="font-body text-center text-xs text-gray-500 mt-6">
          講師成長的飛行訓練平台
        </p>
      </div>
    </div>
  );
}
