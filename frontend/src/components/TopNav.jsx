import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';

export function TopNav({ title, subtitle, showAdminLink = false, showBackButton = false }) {
  const navigate = useNavigate();
  const { user, logout } = useStore();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex flex-wrap justify-between items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {showBackButton && (
              <button
                onClick={() => navigate(-1)}
                className="font-heading font-semibold text-primary hover:text-primary-dark transition shrink-0 text-sm sm:text-base"
              >
                ← 返回
              </button>
            )}
            <div className="min-w-0">
              <h1 className="font-heading text-lg sm:text-2xl font-bold text-primary truncate">中華益師益友協會</h1>
              <p className="font-body text-xs sm:text-sm text-gray-500 mt-0.5">伴飛計畫 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-6 shrink-0">
            {user?.display_name && (
              <span className="font-body text-xs sm:text-sm text-gray-700 hidden sm:inline max-w-[100px] truncate">
                {user.display_name}
              </span>
            )}
            {showAdminLink && (user?.user_role === 'admin' || user?.user_role === 'instructor') && (
              <button
                onClick={() => navigate('/admin')}
                className="font-heading font-semibold px-3 sm:px-4 py-2 rounded-md border border-primary text-primary hover:bg-primary-light transition text-sm"
              >
                管理
              </button>
            )}
            <button
              onClick={logout}
              className="font-heading font-semibold px-3 sm:px-4 py-2 rounded-md border border-red-300 text-red-700 hover:bg-red-50 transition text-sm"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default TopNav;
