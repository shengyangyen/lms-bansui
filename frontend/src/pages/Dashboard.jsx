import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import TopNav from '../components/TopNav';
import api from '../api';

const TABS = [
  { id: 'dashboard', label: '飛行儀表板' },
  { id: 'courses', label: '課程與作業' },
  { id: 'profile', label: '個人資訊管理' },
  { id: 'messages', label: '訊息聯絡' }
];
const TAB_LEADERBOARD = { id: 'leaderboard', label: '排行榜' };

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [levelData, setLevelData] = useState(null);
  const [badges, setBadges] = useState([]);
  const [activities, setActivities] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [myMessages, setMyMessages] = useState([]);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const { user } = useStore();
  const navigate = useNavigate();

  const fetchLeaderboardVisible = () => {
    api
      .get('/leaderboard/visible')
      .then((r) => setLeaderboardVisible(!!r.data?.visible))
      .catch((err) => {
        console.warn('[leaderboard] visible 取得失敗:', err?.response?.data || err.message);
      });
  };

  useEffect(() => {
    fetchCourses();
    fetchLevel();
    fetchBadges();
    fetchActivities();
    fetchLeaderboardVisible();
  }, []);

  useEffect(() => {
    if (activeTab === 'messages') fetchMyMessages();
  }, [activeTab]);

  const fetchBadges = async () => {
    try {
      const { data } = await api.get('/users/me/badges');
      setBadges(data || []);
    } catch {
      setBadges([]);
    }
  };

  const fetchActivities = async () => {
    try {
      const { data } = await api.get('/users/me/activities?limit=50');
      setActivities(data || []);
    } catch {
      setActivities([]);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data } = await api.get('/courses');
      setCourses(data);
    } catch (error) {
      console.error('取得課程失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLevel = async () => {
    try {
      const { data } = await api.get(`/users/me/level?t=${Date.now()}`);
      setLevelData(data);
    } catch (error) {
      setLevelData({ level: 1, currentExp: 0, expToNextLevel: 100, totalExp: 0 });
    }
  };

  const fetchMyMessages = async () => {
    try {
      const { data } = await api.get(`/messages/me?t=${Date.now()}`);
      setMyMessages(data || []);
    } catch (err) {
      console.error('取得訊息失敗:', err);
      // 不要清空，避免覆蓋樂觀更新
    }
  };

  useEffect(() => {
    const onFocus = () => {
      fetchLevel();
      fetchLeaderboardVisible();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert('新密碼與確認密碼不符');
      return;
    }
    if (passwordForm.new.length < 6) {
      alert('新密碼至少 6 個字');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new
      });
      alert('密碼已更新');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      alert(err.response?.data?.error || '更新失敗');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    const content = messageContent.trim();
    setMessageSending(true);
    try {
      const { data } = await api.post('/messages', { content });
      setMessageContent('');
      // 樂觀更新：立即顯示
      setMyMessages((prev) => [{ id: data.id, content, created_at: data.created_at }, ...prev]);
      alert('訊息已送出');
      // 背景刷新，成功才覆蓋（fetchMyMessages 失敗時不會清空）
      fetchMyMessages();
    } catch (err) {
      console.error('發送訊息失敗:', err?.response?.data || err);
      alert(err.response?.data?.error || err.message || '發送失敗');
    } finally {
      setMessageSending(false);
    }
  };

  const level = levelData?.level ?? 1;
  const currentExp = levelData?.currentExp ?? 0;
  const expToNext = levelData?.expToNextLevel ?? 100;
  const progressPercent = Math.min(100, currentExp);

  return (
    <div className="page-container min-h-screen">
      <TopNav showAdminLink={true} />

      {/* 書籤頁 */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex gap-1 flex-nowrap sm:flex-wrap min-w-max sm:min-w-0 pb-px">
            {[...TABS, ...(leaderboardVisible ? [TAB_LEADERBOARD] : [])].map((tab) => (
              <button
                key={tab.id}
                onClick={() => (tab.id === 'leaderboard' ? navigate('/leaderboard') : setActiveTab(tab.id))}
                className={`px-4 py-3 font-semibold text-sm transition border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:py-8 px-3 sm:px-4">
        {/* 1. 飛行儀表板（個人儀表板） */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* 歡迎區塊 */}
            <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 sm:p-8">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-1">
                歡迎回來，{user?.name || user?.email?.split('@')[0] || '飛行員'}！
              </h1>
              <p className="text-gray-600 text-sm">你的學習進度與最新動態</p>
            </div>

            {leaderboardVisible && (
              <div className="card bg-primary-light/50 border-primary/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span className="font-semibold text-primary">🏆 排行榜已開放</span>
                  <button
                    onClick={() => navigate('/leaderboard')}
                    className="btn-primary-solid px-4 py-2 text-sm"
                  >
                    前往排行榜
                  </button>
                </div>
              </div>
            )}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-bold text-gray-800">飛行員等級</h2>
                <span className="font-heading text-2xl font-bold text-primary">Lv.{level}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>經驗值 {currentExp} / 100</span>
                  <span>再 {expToNext} 即可升級</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="font-heading text-lg font-bold text-gray-800 mb-4">徽章蒐集區</h2>
              {badges.length === 0 ? (
                <p className="text-gray-500 text-sm">尚無徽章，完成任務解鎖更多！</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200"
                      title={b.description}
                    >
                      <span className="w-10 h-10 flex items-center justify-center text-2xl hidden shrink-0" aria-hidden>🏅</span>
                      <img
                        src={`/badges/${encodeURIComponent(b.image || b.id + '.png')}`}
                        alt={b.name}
                        className="w-10 h-10 object-contain shrink-0"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.previousElementSibling;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <span className="font-semibold text-gray-800">{b.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="font-heading text-lg font-bold text-gray-800 mb-4">最新消息</h2>
              {activities.length === 0 ? (
                <p className="text-gray-500 text-sm">尚無動態</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {activities.slice(0, 3).map((a, i) => (
                      <li key={a.id ?? i} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-800">{a.message}</span>
                        <span className="text-gray-500 text-sm">{a.date ? new Date(a.date).toLocaleDateString('zh-TW') : ''}</span>
                      </li>
                    ))}
                  </ul>
                  {activities.length > 3 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-primary font-semibold text-sm hover:underline">
                        展開其餘 {activities.length - 3} 則動態
                      </summary>
                      <ul className="space-y-2 mt-2 pl-2 border-l-2 border-gray-200">
                        {activities.slice(3).map((a, i) => (
                          <li key={a.id ?? `more-${i}`} className="flex justify-between items-center py-1 text-sm">
                            <span className="text-gray-700">{a.message}</span>
                            <span className="text-gray-500 text-xs">{a.date ? new Date(a.date).toLocaleDateString('zh-TW') : ''}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 2. 課程與作業 */}
        {activeTab === 'courses' && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-gray-800 mb-2">我的課程</h2>
            <p className="font-body text-gray-600 mb-6">開始你的飛行訓練之旅</p>
            {loading ? (
              <div className="text-center py-12 text-gray-600">載入中...</div>
            ) : courses.length === 0 ? (
              <div className="card text-center py-12">
                <p className="font-body text-gray-600">還沒有任何課程</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <Link key={course.id} to={`/course/${course.id}`}>
                    <div className="card h-full hover:shadow-lg hover:scale-105 transform transition duration-200 cursor-pointer">
                      <h3 className="font-heading text-xl font-bold text-gray-800 mb-3">{course.title}</h3>
                      <p className="font-body text-gray-600 mb-4 line-clamp-2">{course.description}</p>
                      <div className="flex items-center text-primary font-heading font-semibold group">
                        進入課程
                        <span className="ml-2 transition group-hover:translate-x-1">→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. 個人資訊管理 */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl space-y-8">
            <h2 className="font-heading text-2xl font-bold text-gray-800 mb-6">修改密碼</h2>
            <form onSubmit={handleChangePassword} className="card space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">目前密碼</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">新密碼</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="input-field"
                  minLength={6}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">至少 6 個字</p>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">確認新密碼</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={passwordSaving}
                className="btn-primary px-6 py-2 disabled:opacity-50"
              >
                {passwordSaving ? '處理中...' : '更新密碼'}
              </button>
            </form>
          </div>
        )}

        {/* 4. 訊息聯絡 */}
        {activeTab === 'messages' && (
          <div className="max-w-2xl">
            <h2 className="font-heading text-2xl font-bold text-gray-800 mb-6">向管理者私訊</h2>
            <form onSubmit={handleSendMessage} className="card space-y-4 mb-8">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">訊息內容</label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="輸入想傳達給管理者的內容..."
                  className="input-field min-h-[100px]"
                  rows="4"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={messageSending}
                className="btn-primary px-6 py-2 disabled:opacity-50"
              >
                {messageSending ? '發送中...' : '發送'}
              </button>
            </form>
            <div className="card">
              <h3 className="font-heading text-lg font-bold text-gray-800 mb-4">我發送的訊息</h3>
              {myMessages.length === 0 ? (
                <p className="text-gray-500 text-sm">尚無發送紀錄</p>
              ) : (
                <ul className="space-y-3">
                  {myMessages.map((m) => (
                    <li key={m.id} className="py-3 border-b border-gray-100 last:border-0">
                      <p className="text-gray-800 whitespace-pre-wrap">{m.content}</p>
                      <p className="text-gray-500 text-sm mt-1">{m.created_at ? new Date(m.created_at).toLocaleString('zh-TW') : ''}</p>
                      {m.reply_content && (
                        <div className="mt-3 pl-4 border-l-2 border-primary bg-primary-light/30 py-2 rounded-r">
                          <p className="text-sm font-semibold text-primary">管理者回覆</p>
                          <p className="text-gray-700 whitespace-pre-wrap text-sm mt-1">{m.reply_content}</p>
                          <p className="text-gray-500 text-xs mt-1">{m.reply_at ? new Date(m.reply_at).toLocaleString('zh-TW') : ''}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
