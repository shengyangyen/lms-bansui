import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import api, { fetchWithAuth } from '../api';
import { formatTaipeiDateTime } from '../utils/datetime';

export default function SubmitAssignment() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useStore();
  const [assignment, setAssignment] = useState(null);
  const [mySubmission, setMySubmission] = useState(null);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [formAnswers, setFormAnswers] = useState({});
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isFormAssignment = assignment?.assignment_type === 'form';

  useEffect(() => {
    fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      const assignmentRes = await api.get(`/assignments/${assignmentId}`);
      const assignmentData = assignmentRes.data;
      setAssignment(assignmentData);

      if (assignmentData.assignment_type === 'form') {
        const results = await Promise.allSettled([
          api.get(`/assignments/${assignmentId}/my-form-submission`),
          api.get(`/assignments/${assignmentId}/my-form-submissions-history`)
        ]);
        if (results[0].status === 'fulfilled') {
          setMySubmission(results[0].value.data);
        } else {
          console.error('取得提交失敗', results[0].reason);
        }
        if (results[1].status === 'fulfilled') {
          setSubmissionHistory(results[1].value.data || []);
        } else {
          console.error('取得提交歷史失敗', results[1].reason);
        }
      } else {
        const results = await Promise.allSettled([
          api.get(`/assignments/${assignmentId}/my-submission`),
          api.get(`/assignments/${assignmentId}/my-submissions-history`)
        ]);
        if (results[0].status === 'fulfilled') {
          setMySubmission(results[0].value.data);
        } else {
          console.error('取得提交失敗', results[0].reason);
        }
        if (results[1].status === 'fulfilled') {
          setSubmissionHistory(results[1].value.data || []);
        } else {
          console.error('取得提交歷史失敗', results[1].reason);
        }
      }
    } catch (error) {
      console.error('取得資料失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitting(true);

    try {
      if (isFormAssignment) {
        await api.post(`/assignments/${assignmentId}/form-submit`, {
          answers: formAnswers
        });
      } else {
        if (!file) {
          alert('請選擇要提交的檔案');
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', file);

        await api.post(`/assignments/${assignmentId}/submit`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setFile(null);
      fetchData();
      alert('提交成功！');
    } catch (error) {
      console.error('提交失敗', error);
      alert('提交失敗，請重試');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="page-container flex items-center justify-center"><span className="font-body text-gray-600">載入中...</span></div>;
  }

  if (!assignment) {
    return <div className="page-container flex items-center justify-center"><span className="font-body text-gray-600">作業不存在</span></div>;
  }

  return (
    <div className="page-container min-h-screen">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="font-heading font-semibold text-primary hover:text-primary-dark transition"
          >
            ← 返回
          </button>
          <h1 className="font-heading text-lg sm:text-2xl font-bold text-primary truncate">提交作業</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-6 sm:py-12 px-3 sm:px-4">
        {/* 作業詳情 */}
        <div className="card mb-8">
          <h2 className="font-heading text-xl sm:text-3xl font-bold text-gray-800 mb-4 break-words">{assignment.title}</h2>
          <div className="bg-primary-light p-6 rounded-md border-l-4 border-primary mb-6">
            <p className="font-body text-gray-700 whitespace-pre-wrap">{assignment.description}</p>
          </div>
          <p className="font-body text-sm text-gray-600">
            📅 建立於 {formatTaipeiDateTime(assignment.created_at)}（台北時間）
          </p>
          <p className="font-body text-sm text-green-700 font-semibold mt-2">
            ✓ 永久開放提交，可無限次修改
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 提交表單 */}
          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="font-heading text-xl font-bold text-gray-800 mb-6">提交你的作業</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                  {isFormAssignment ? (
                  <div className="space-y-4">
                    {(assignment.questions || []).length === 0 ? (
                      <p className="text-sm text-gray-600">這份填空題尚未設定題目。</p>
                    ) : (
                      (assignment.questions || []).map((q) => (
                        <div key={q.id}>
                          <label className="block text-gray-700 font-semibold mb-2">
                            {q.question_number}. {q.title}
                            {q.required ? ' *' : ''}
                          </label>
                          {q.description && (
                            <p className="text-sm text-gray-500 mb-2">{q.description}</p>
                          )}
                          <textarea
                            value={formAnswers[q.id] || ''}
                            onChange={(e) =>
                              setFormAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows="4"
                            required={q.required}
                          />
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      選擇要提交的檔案 *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center hover:border-blue-500 transition">
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="file-input"
                        required
                      />
                      <label htmlFor="file-input" className="cursor-pointer">
                        <div className="text-4xl mb-2">📁</div>
                        {file ? (
                          <div>
                            <p className="text-gray-800 font-semibold">{file.name}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-gray-700 font-semibold">點擊或拖放檔案到此</p>
                            <p className="text-sm text-gray-600 mt-1">
                              支援所有常見的檔案格式（Word、PDF、圖片等）
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (!isFormAssignment && !file)
                  }
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition text-lg"
                >
                  {submitting
                    ? '提交中...'
                    : isFormAssignment
                      ? '提交答案'
                      : '提交作業'}
                </button>
              </form>

              <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>小提示：</strong> 你可以無限次提交修改版本。如果尚未被批改，新版本會覆蓋舊版本。已批改的版本會保留歷史記錄。
                </p>
              </div>
            </div>
          </div>

          {/* 提交狀態 */}
          <div className="lg:col-span-1">
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow lg:sticky lg:top-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">提交狀態</h3>

              {mySubmission ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-sm font-semibold text-gray-700 mb-2">最新提交</p>
                    <p className="text-xs text-gray-600 mb-3">
                      {formatTaipeiDateTime(mySubmission.submitted_at)}
                    </p>
                    {isFormAssignment ? (
                      <div className="space-y-1 mb-3">
                        <button
                          onClick={() => window.open(`/api/form-submissions/${mySubmission.id}/export/pdf`, '_blank')}
                          className="text-xs text-blue-600 hover:text-blue-700 underline block"
                        >
                          📄 匯出 PDF
                        </button>
                        <button
                          onClick={() => window.open(`/api/form-submissions/${mySubmission.id}/export/excel`, '_blank')}
                          className="text-xs text-blue-600 hover:text-blue-700 underline block"
                        >
                          📊 匯出 Excel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/submissions/${mySubmission.id}/download`);
                            const blob = await response.blob();
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = mySubmission.file_name;  // 用中文檔名
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error('下載失敗', error);
                            alert('下載失敗，請重試');
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline block mb-3"
                      >
                        下載已提交的檔案
                      </button>
                    )}
                    {mySubmission.version_number > 1 && (
                      <p className="text-xs text-gray-600">
                        版本號: {mySubmission.version_number}
                      </p>
                    )}
                  </div>

                  {mySubmission.feedback && mySubmission.feedback.length > 0 ? (
                    <div className="p-4 bg-green-50 rounded border-l-4 border-green-500">
                      <p className="text-sm font-semibold text-gray-700 mb-2">✓ 已批改</p>
                      {mySubmission.feedback[mySubmission.feedback.length - 1] && (
                        <div>
                          <p className="text-xs text-gray-600 mb-2">
                            評分：
                            <span
                              className={`font-semibold ml-1 ${
                                mySubmission.feedback[
                                  mySubmission.feedback.length - 1
                                ].grade === '建議需調整'
                                  ? 'text-red-600'
                                  : mySubmission.feedback[
                                      mySubmission.feedback.length - 1
                                    ].grade === '合格'
                                    ? 'text-green-600'
                                    : 'text-blue-600'
                              }`}
                            >
                              {
                                mySubmission.feedback[mySubmission.feedback.length - 1]
                                  .grade
                              }
                            </span>
                          </p>
                          {mySubmission.feedback[mySubmission.feedback.length - 1]
                            .comment && (
                            <p className="text-xs text-gray-700 mt-2">
                              {
                                mySubmission.feedback[mySubmission.feedback.length - 1]
                                  .comment
                              }
                            </p>
                          )}
                          <button
                            onClick={() =>
                              navigate(`/assignment-feedback/${mySubmission.id}`)
                            }
                            className="mt-3 text-xs text-blue-600 hover:text-blue-700 underline"
                          >
                            查看完整批改記錄
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                      <p className="text-sm font-semibold text-gray-700">
                        ⏳ 待批改
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        老師會很快批改你的作業
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <button
                      onClick={() => setShowHistory((prev) => !prev)}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      {showHistory ? '收合我的提交歷程' : '查看我的提交歷程'}
                    </button>

                    {showHistory && (
                      <div className="mt-4">
                        {submissionHistory.length === 0 ? (
                          <p className="text-xs text-gray-600">尚無歷程資料</p>
                        ) : (
                          <div className="relative pl-4">
                            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-300" />
                            <div className="space-y-4">
                              {submissionHistory.map((item) => {
                                const latestFeedback =
                                  item.feedback && item.feedback.length > 0
                                    ? item.feedback[item.feedback.length - 1]
                                    : null;

                                return (
                                  <div key={item.id} className="relative">
                                    <div className="absolute -left-[1px] top-2 h-4 w-4 rounded-full bg-blue-500 ring-2 ring-white" />
                                    <div className="ml-6 p-3 bg-gray-50 rounded border">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold text-gray-800">
                                          版本 {item.version_number}
                                          {item.is_latest ? '（最新）' : ''}
                                        </span>
                                        <span className="text-[11px] text-gray-500">
                                          {formatTaipeiDateTime(item.submitted_at)}
                                        </span>
                                      </div>

                                      {isFormAssignment ? (
                                        <div className="flex gap-3">
                                          <button
                                            onClick={() =>
                                              window.open(`/api/form-submissions/${item.id}/export/pdf`, '_blank')
                                            }
                                            className="text-[11px] text-blue-600 hover:text-blue-700 underline"
                                          >
                                            匯出 PDF
                                          </button>
                                          <button
                                            onClick={() =>
                                              window.open(`/api/form-submissions/${item.id}/export/excel`, '_blank')
                                            }
                                            className="text-[11px] text-blue-600 hover:text-blue-700 underline"
                                          >
                                            匯出 Excel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={async () => {
                                            try {
                                              const response = await fetchWithAuth(`/api/submissions/${item.id}/download`);
                                              const blob = await response.blob();
                                              const url = URL.createObjectURL(blob);
                                              const link = document.createElement('a');
                                              link.href = url;
                                              link.download = item.file_name;  // 用中文檔名
                                              document.body.appendChild(link);
                                              link.click();
                                              document.body.removeChild(link);
                                              URL.revokeObjectURL(url);
                                            } catch (error) {
                                              console.error('下載失敗', error);
                                              alert('下載失敗，請重試');
                                            }
                                          }}
                                          className="text-[11px] text-blue-600 hover:text-blue-700 underline"
                                        >
                                          下載此版本（{item.file_name}）
                                        </button>
                                      )}

                                      {latestFeedback ? (
                                        <div className="mt-2 p-2 bg-white rounded border-l-4 border-green-500">
                                          <p className="text-[11px] text-gray-700">
                                            評分：{latestFeedback.grade}
                                          </p>
                                          {latestFeedback.comment && (
                                            <p className="text-[11px] text-gray-600 mt-1">
                                              {latestFeedback.comment}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="mt-2 p-2 bg-white rounded border-l-4 border-yellow-500">
                                          <p className="text-[11px] text-gray-600">尚未批改</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm text-gray-600">
                    還沒有提交任何作業。上傳檔案後開始提交吧！
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
