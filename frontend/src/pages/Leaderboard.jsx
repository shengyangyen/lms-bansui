import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import api from '../api';

const CATEGORIES = [
  { key: 'exp', label: '經驗值總數', valueLabel: '經驗值' },
  { key: 'badges', label: '徽章蒐集數', valueLabel: '枚' },
  { key: 'excellent', label: '優良作業數', valueLabel: '次' },
  { key: 'comments', label: '討論回饋數', valueLabel: '則' }
];

function RankCard({ title, items, valueLabel }) {
  return (
    <div className="card">
      <h3 className="font-heading text-lg font-bold text-gray-800 mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm">尚無資料</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li
              key={`${item.user_id}-${idx}`}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100"
            >
              <span className="font-semibold text-gray-700">
                <span className="inline-block w-8 text-primary">#{item.rank}</span>
                {item.name}
              </span>
              <span className="text-gray-600 font-medium">
                {item.value} {valueLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/leaderboard')
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          setError('排行榜目前未開放');
        } else {
          setError('載入失敗');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container min-h-screen">
        <TopNav showAdminLink />
        <div className="max-w-7xl mx-auto py-8 sm:py-12 px-3 sm:px-4 text-center text-gray-600">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container min-h-screen">
        <TopNav showAdminLink />
        <div className="max-w-7xl mx-auto py-12 text-center">
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container min-h-screen">
      <TopNav showAdminLink />
      <div className="max-w-7xl mx-auto py-6 sm:py-8 px-3 sm:px-4">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gray-800 mb-2">排行榜</h1>
        <p className="text-gray-600 mb-8">各項評比名列前茅的學員（同分並列）</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CATEGORIES.map((cat) => (
            <RankCard
              key={cat.key}
              title={cat.label}
              items={data?.[cat.key] || []}
              valueLabel={cat.valueLabel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
