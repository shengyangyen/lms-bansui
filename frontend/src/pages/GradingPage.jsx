import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fetchWithAuth } from '../api';
import { formatTaipeiDateTime } from '../utils/datetime';

export default function GradingPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [featuredNotes, setFeaturedNotes] = useState([]);
  const [grade, setGrade] = useState('合格');
  const [comment, setComment] = useState('');
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [markingFeatured, setMarkingFeatured] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    fetchData();
  }, [submissionId]);

  const fetchData = async () => {
    try {
      const [submissionRes, historyRes, notesRes] = await Promise.all([
        api.get(`/submissions/${submissionId}`),
        api.get(`/submissions/${submissionId}/feedback-history`),
        api.get(`/submissions/${submissionId}/featured-notes`)
      ]);
      setSubmission(submissionRes.data);
      setFeedbackHistory(historyRes.data);
      setFeaturedNotes(notesRes.data);
      setIsFeatured(submissionRes.data.is_featured || false);
    } catch (error) {
      console.error('取得資料失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('grade', grade);
      formData.append('comment', comment);
      if (feedbackFile) {
        formData.append('file', feedbackFile);
      }

      await api.post(`/submissions/${submissionId}/feedback`, formData);

      setComment('');
      setFeedbackFile(null);
      fetchData();
      alert('批改已提交');
    } catch (error) {
      console.error('提交批改失敗', error);
      alert('提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFeatured = async () => {
    setMarkingFeatured(true);
    try {
      await api.patch(`/submissions/${submissionId}/featured`, {
        isFeatured: !isFeatured
      });
      setIsFeatured(!isFeatured);
      fetchData();
      alert(isFeatured ? '已取消優秀作品標記' : '已標記為優秀作品');
    } catch (error) {
      console.error('標記失敗', error);
      alert('標記失敗');
    } finally {
      setMarkingFeatured(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      alert('批註內容不能為空');
      return;
    }
    setAddingNote(true);
    try {
      await api.post(`/submissions/${submissionId}/featured-notes`, {
        content: newNote
      });
      setNewNote('');
      fetchData();
      alert('批註已添加');
    } catch (error) {
      console.error('添加批註失敗', error);
      alert('添加失敗');
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-600 py-12">載入中...</div>;
  }

  return (
    <div className="page-container min-h-screen">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="font-heading font-semibold text-primary hover:text-primary-dark transition"
          >
            ← 返回
          </button>
          <h1 className="font-heading text-2xl font-bold text-primary">批改作業</h1>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-12 px-4">
        <div className="grid grid-cols-3 gap-6">
          {/* 提交的作業 */}
          <div className="col-span-2">
            <div className="card mb-6">
              <h2 className="font-heading text-xl font-bold text-gray-800 mb-4">學生提交的作業</h2>
              {submission && (
                <div>
                  <p className="text-gray-600 mb-2">
                    <strong>學生：</strong> {submission.users?.full_name}
                  </p>
                  <p className="text-gray-600 mb-4">
                    <strong>提交時間：</strong>{' '}
                    {formatTaipeiDateTime(submission.submitted_at)}
                  </p>
                  {submission.form_submission ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => window.open(`/api/form-submissions/${submission.form_submission.id}/export/pdf`, '_blank')}
                        className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
                      >
                        匯出 PDF
                      </button>
                      <button
                        onClick={() => window.open(`/api/form-submissions/${submission.form_submission.id}/export/excel`, '_blank')}
                        className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded font-semibold"
                      >
                        匯出 Excel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetchWithAuth(`/api/submissions/${submission.id}/download`);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = submission.file_name;
                          link.click();
                          URL.revokeObjectURL(url);
                        } catch (e) {
                          alert('下載失敗');
                        }
                      }}
                      className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
                    >
                      📥 下載檔案
                    </button>
                  )}
                </div>
              )}
            </div>

            {submission?.resolved_answers && submission.resolved_answers.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">學生作答內容</h2>
                <div className="space-y-4">
                  {submission.resolved_answers.map((qa) => (
                    <div key={qa.question_number} className="p-4 bg-gray-50 rounded border">
                      <p className="font-semibold text-gray-800">
                        題目{qa.question_number}：{qa.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        說明：{qa.description || '(無)'}
                      </p>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                        答案：{qa.answer || '(空白)'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 優秀作品區 */}
            <div className={`p-6 rounded-lg shadow mb-6 ${isFeatured ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {isFeatured ? '優秀作品' : '優秀作品標記'}
                </h2>
                <button
                  onClick={handleToggleFeatured}
                  disabled={markingFeatured}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    isFeatured
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                  } disabled:opacity-50`}
                >
                  {markingFeatured ? '處理中...' : isFeatured ? '取消標記' : '標記為優秀作品'}
                </button>
              </div>

              {isFeatured && (
                <div className="space-y-4">
                  {/* 批註列表 */}
                  {featuredNotes.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-700 mb-2">教師批註</h3>
                      <div className="space-y-3">
                        {featuredNotes.map((note) => (
                          <div key={note.id} className="bg-white p-3 rounded border border-yellow-200">
                            <p className="text-sm font-semibold text-gray-600">
                              {note.users?.display_name || note.users?.email}
                            </p>
                            <p className="text-gray-700 mt-1 whitespace-pre-wrap">{note.content}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(note.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 新增批註表單 */}
                  <div className="border-t border-yellow-200 pt-4">
                    <label className="block text-gray-700 font-semibold mb-2">
                      新增觀摩批註
                    </label>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="為其他同學提供觀摩指導..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      rows="3"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={addingNote || !newNote.trim()}
                      className="mt-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded transition"
                    >
                      {addingNote ? '添加中...' : '添加批註'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 批改表單 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-gray-800 mb-4">添加批改反饋</h2>
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    評分等級 *
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="建議需調整">
                      🔴 建議需調整 - 需要改進
                    </option>
                    <option value="合格">🟢 合格 - 達到要求</option>
                    <option value="優秀">🟡 優秀 - 超出期望</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    批改意見
                  </label>
                  <textarea
                    placeholder="輸入對學生的指導意見..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows="6"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    上傳反饋檔案（可選）
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFeedbackFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    可上傳修正範例、圖片說明或其他參考檔案
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  {submitting ? '提交中...' : '提交批改'}
                </button>
              </form>
            </div>
          </div>

          {/* 批改歷史 */}
          <div>
            <div className="bg-white p-6 rounded-lg shadow sticky top-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">批改歷史</h2>
              {feedbackHistory.length === 0 ? (
                <p className="text-gray-600 text-center py-6">還沒有批改記錄</p>
              ) : (
                <div className="space-y-4">
                  {feedbackHistory.map((fb, idx) => (
                    <div
                      key={fb.id}
                      className={`p-4 rounded border-l-4 ${
                        fb.grade === '建議需調整'
                          ? 'border-red-500 bg-red-50'
                          : fb.grade === '合格'
                            ? 'border-green-500 bg-green-50'
                            : 'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-700">
                          批改 #{feedbackHistory.length - idx}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            fb.grade === '建議需調整'
                              ? 'text-red-600'
                              : fb.grade === '合格'
                                ? 'text-green-600'
                                : 'text-blue-600'
                          }`}
                        >
                          {fb.grade}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        {formatTaipeiDateTime(fb.created_at)}
                      </p>
                      {fb.comment && (
                        <p className="text-sm text-gray-700 mb-2">{fb.comment}</p>
                      )}
                      {(fb.feedback_file_url || fb.feedback_image_url || fb.drive_file_id) && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetchWithAuth(`/api/feedback/${fb.id}/download`);
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = fb.feedback_file_url?.split('/').pop() || 'feedback';
                              link.click();
                              URL.revokeObjectURL(url);
                            } catch (e) {
                              alert('下載失敗');
                            }
                          }}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          📎 下載反饋檔案
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
