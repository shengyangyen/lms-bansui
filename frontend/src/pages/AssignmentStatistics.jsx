import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatTaipeiDateTime } from '../utils/datetime';

export default function AssignmentStatistics() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [statusDetails, setStatusDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      const [assignmentRes, statsRes] = await Promise.all([
        api.get(`/assignments/${assignmentId}`),
        api.get(`/assignments/${assignmentId}/statistics`)
      ]);
      setAssignment(assignmentRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('取得資料失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusClick = async (status) => {
    try {
      const { data } = await api.get(`/assignments/${assignmentId}/submissions-by-status/${status}`);
      setStatusDetails(data);
      setSelectedStatus(status);
    } catch (error) {
      console.error('取得詳細資料失敗', error);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  const statusConfig = {
    not_submitted: { label: '應繳交', color: 'bg-gray-100 border-gray-300', textColor: 'text-gray-700', count: stats?.not_submitted },
    submitted: { label: '已繳交', color: 'bg-blue-100 border-blue-300', textColor: 'text-blue-700', count: stats?.submitted },
    not_graded: { label: '待批閱', color: 'bg-yellow-100 border-yellow-300', textColor: 'text-yellow-700', count: stats?.submitted - stats?.graded },
    needs_revision: { label: '待調整', color: 'bg-red-100 border-red-300', textColor: 'text-red-700', count: stats?.needs_revision },
    pass: { label: '已完成', color: 'bg-green-100 border-green-300', textColor: 'text-green-700', count: stats?.pass },
    excellent: { label: '優秀', color: 'bg-purple-100 border-purple-300', textColor: 'text-purple-700', count: stats?.excellent }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-500 hover:text-blue-700"
          >
            ← 返回
          </button>
          <h1 className="text-2xl font-bold text-purple-600">作業統計</h1>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-12 px-4">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">{assignment?.title}</h2>
        <p className="text-gray-600 mb-8">{assignment?.description}</p>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {Object.entries(statusConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handleStatusClick(key)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition transform hover:scale-105 ${config.color}`}
            >
              <div className={`text-3xl font-bold ${config.textColor}`}>
                {config.count || 0}
              </div>
              <div className={`text-sm font-semibold ${config.textColor} mt-2`}>
                {config.label}
              </div>
            </button>
          ))}
        </div>

        {/* 詳細列表 */}
        {selectedStatus && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {statusConfig[selectedStatus].label} 
              <span className="text-lg text-gray-500 ml-2">({statusDetails.length})</span>
            </h3>

            {statusDetails.length === 0 ? (
              <p className="text-center text-gray-600 py-8">沒有相關資料</p>
            ) : (
              <div className="space-y-4">
                {statusDetails.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {item.users?.full_name || '匿名用戶'}
                        </h4>
                        <p className="text-sm text-gray-600">{item.users?.email}</p>
                      </div>
                      {selectedStatus !== 'not_submitted' && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            提交於 {formatTaipeiDateTime(item.submitted_at)}
                          </p>
                          {item.version_number > 1 && (
                            <p className="text-xs text-blue-600 mt-1">
                              版本 {item.version_number}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedStatus !== 'not_submitted' && item.feedback && item.feedback.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-700">最新評分：</span>
                          <span
                            className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${
                              item.feedback[item.feedback.length - 1].grade === '優秀'
                                ? 'bg-purple-500'
                                : item.feedback[item.feedback.length - 1].grade === '合格'
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                            }`}
                          >
                            {item.feedback[item.feedback.length - 1].grade}
                          </span>
                        </div>
                        {item.feedback[item.feedback.length - 1].comment && (
                          <p className="text-sm text-gray-700 mt-2">
                            {item.feedback[item.feedback.length - 1].comment}
                          </p>
                        )}
                        <button
                          onClick={() => navigate(`/admin/submissions/${item.id}/feedback`)}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          查看完整批改記錄
                        </button>
                      </div>
                    )}

                    {selectedStatus !== 'not_submitted' && (!item.feedback || item.feedback.length === 0) && (
                      <button
                        onClick={() => navigate(`/admin/submissions/${item.id}/feedback`)}
                        className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                      >
                        添加批改
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedStatus && (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600 text-lg">點擊上方統計卡片查看詳細資訊</p>
          </div>
        )}
      </div>
    </div>
  );
}
