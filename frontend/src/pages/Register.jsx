import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [displayName, setDisplayName] = useState('');
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('密碼不相符');
      return;
    }
    
    if (password.length < 6) {
      setError('密碼至少 6 個字');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await api.post('/auth/register', { 
        email, 
        password, 
        displayName, 
        realName
      });
      setSuccess('註冊成功！請檢查信箱驗證信，之後等待管理員審核。');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container flex items-center justify-center p-4 relative overflow-hidden">
      {/* 飛航主題背景 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-40 h-40 rounded-full bg-primary/5 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        <div className="card">
          {/* 標題 */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-heading text-xl sm:text-3xl font-bold text-primary mb-2">中華益師益友協會</h1>
            <p className="font-body text-sm text-gray-500">伴飛計畫 2026</p>
          </div>

          {/* 提示訊息 */}
          {error && <div className="alert-error mb-4">{error}</div>}
          {success && <div className="alert-success mb-4">{success}</div>}

          {/* 表單 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">暱稱 (顯示名稱)</label>
              <input
                type="text"
                placeholder="例：小王"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="input-label">真實姓名</label>
              <input
                type="text"
                placeholder="例：王小明"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="input-label">電子郵件</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
              />
              <p className="text-xs text-gray-500 mt-2">需通過驗證</p>
            </div>

            <div>
              <label className="input-label">密碼</label>
              <input
                type="password"
                placeholder="至少 6 個字"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="input-label">確認密碼</label>
              <input
                type="password"
                placeholder="再輸入一次密碼"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>

            {/* 建立帳號按鈕 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-heading font-semibold py-2.5 px-4 rounded-md border-2 border-primary text-primary hover:bg-primary-light transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? '處理中...' : '建立帳號'}
            </button>
          </form>

          {/* 登入連結 */}
          <p className="font-body text-center text-sm text-gray-600 mt-6">
            已有帳號？{' '}
            <Link to="/login" className="text-primary hover:text-primary-dark font-semibold transition">
              登入
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
