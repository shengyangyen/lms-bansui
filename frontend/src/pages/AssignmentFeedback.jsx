import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fetchWithAuth } from '../api';
import { formatTaipeiDateTime } from '../utils/datetime';

function FeedbackImage({ feedbackId }) {
  const [src, setSrc] = useState(null);
  const urlRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    fetchWithAuth(`/api/feedback/${feedbackId}/download`)
      .then((res) => res.blob())
      .then((blob) => {
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          setSrc(url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [feedbackId]);
  if (!src) return <div className="max-w-full rounded border border-gray-300 p-8 text-center text-gray-500">載入中...</div>;
  return <img src={src} alt="批改圖片" className="max-w-full rounded border border-gray-300" />;
}

export default function AssignmentFeedback() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, [submissionId]);

  const fetchFeedback = async () => {
    try {
      const { data } = await api.get(`/submissions/${submissionId}/feedback-history`);
      setFeedbackHistory(data);
    } catch (error) {
      console.error('取得批改記錄失敗', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

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
          <h1 className="text-2xl font-bold text-purple-600">批改記錄</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-4">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">作業批改歷史</h2>

        {feedbackHistory.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600 text-lg">還沒有批改記錄</p>
          </div>
        ) : (
          <div className="space-y-6">
            {feedbackHistory.map((feedback, idx) => {
              const gradeConfig = {
                '建議需調整': { bg: 'bg-red-50', border: 'border-red-500', icon: '🔴' },
                '合格': { bg: 'bg-green-50', border: 'border-green-500', icon: '🟢' },
                '優秀': { bg: 'bg-blue-50', border: 'border-blue-500', icon: '🟡' }
              };

              const config = gradeConfig[feedback.grade] || gradeConfig['合格'];

              return (
                <div
                  key={feedback.id}
                  className={`${config.bg} p-6 rounded-lg border-l-4 ${config.border}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {config.icon} {feedback.grade}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatTaipeiDateTime(feedback.created_at)}
                      </p>
                      <p className="text-sm text-gray-600">
                        批改人：{feedback.users?.full_name || '教師'}
                      </p>
                    </div>
                    <span className="text-3xl opacity-20">{config.icon}</span>
                  </div>

                  {feedback.comment && (
                    <div className="mb-4 p-4 bg-white rounded">
                      <h4 className="font-semibold text-gray-800 mb-2">批改意見：</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {feedback.comment}
                      </p>
                    </div>
                  )}

                  {(feedback.feedback_file_url || feedback.feedback_image_url || feedback.drive_file_id) && (
                    <div className="mb-4 p-4 bg-white rounded">
                      {feedback.feedback_image_url && (
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-800 mb-2">📸 批改圖片：</h4>
                          <FeedbackImage feedbackId={feedback.id} />
                        </div>
                      )}

                      {(feedback.feedback_file_url || feedback.drive_file_id) && (
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2">📎 批改檔案：</h4>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetchWithAuth(`/api/feedback/${feedback.id}/download`);
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = feedback.feedback_file_url?.split('/').pop() || 'feedback';
                                link.click();
                                URL.revokeObjectURL(url);
                              } catch (e) {
                                alert('下載失敗');
                              }
                            }}
                            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold"
                          >
                            下載批改檔案
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-600 italic">
                    批改編號：{feedback.id}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate(-1)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
          >
            返回提交
          </button>
        </div>
      </div>
    </div>
  );
}
