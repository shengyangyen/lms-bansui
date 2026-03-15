import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fetchWithAuth } from '../api';
import { formatTaipeiDateTime } from '../utils/datetime';

export default function FeaturedSubmissions() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    fetchFeaturedSubmissions();
  }, [courseId]);

  const fetchFeaturedSubmissions = async () => {
    try {
      const { data } = await api.get(`/courses/${courseId}/featured-submissions`);
      setSubmissions(data || []);
    } catch (error) {
      console.error('取得優秀作品失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewNotes = async (submissionId) => {
    try {
      const [notesRes, submissionRes] = await Promise.allSettled([
        api.get(`/submissions/${submissionId}/featured-notes`),
        api.get(`/submissions/${submissionId}`)
      ]);
      
      if (notesRes.status === 'fulfilled') {
        setNotes(notesRes.value.data || []);
      }
      
      // 更新提交資料（包含 resolved_answers）
      if (submissionRes.status === 'fulfilled') {
        setSubmissions(submissions.map(s => 
          s.id === submissionId ? submissionRes.value.data : s
        ));
      }
      
      setSelectedSubmission(submissionId);
    } catch (error) {
      console.error('取得批註失敗', error);
    }
  };

  const handleDownload = async (submissionId, fileName) => {
    try {
      const response = await fetchWithAuth(`/api/submissions/${submissionId}/download`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下載失敗', error);
      alert('下載失敗');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-600 py-12">載入中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            ← 返回
          </button>
          <h1 className="text-3xl font-bold text-yellow-600">優秀作品展示</h1>
          <div className="w-24" />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-8 px-4">
        {submissions.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <p className="text-gray-600 text-lg">暫無優秀作品</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
              >
                <div className="p-6">
                  {/* 作品信息頭部 */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        {submission.assignments?.title}
                      </h2>
                      <p className="text-gray-600 mt-1">
                        {submission.assignments?.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-yellow-600">優秀作品</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTaipeiDateTime(submission.featured_at)}
                      </p>
                    </div>
                  </div>

                  {/* 學生信息和文件 */}
                  <div className="bg-gray-50 p-4 rounded mb-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-600">學生</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {submission.users?.display_name || submission.users?.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">版本</p>
                        <p className="text-lg font-semibold text-gray-800">
                          版本 {submission.version_number}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600">提交於</p>
                    <p className="text-gray-700">
                      {formatTaipeiDateTime(submission.submitted_at)}
                    </p>

                    {/* 作品內容 */}
                    {submission.assignments?.assignment_type === 'form' ? (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h3 className="font-semibold text-gray-700 mb-3">作答內容</h3>
                        {submission.resolved_answers && submission.resolved_answers.length > 0 ? (
                          <div className="space-y-3">
                            {submission.resolved_answers.map((qa, idx) => (
                              <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                                <p className="font-semibold text-gray-700">
                                  題目 {qa.question_number}：{qa.title}
                                </p>
                                <p className="text-gray-600 mt-2 whitespace-pre-wrap">
                                  {qa.answer || '(未作答)'}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600">無作答內容</p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleDownload(submission.id, submission.file_name)}
                          className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold"
                        >
                          下載作品檔案
                        </button>
                        <p className="text-sm text-gray-600 mt-2">檔案：{submission.file_name}</p>
                      </div>
                    )}
                  </div>

                  {/* 查看批註按鈕 */}
                  <button
                    onClick={() => handleViewNotes(submission.id)}
                    className={`px-4 py-2 rounded font-semibold transition ${
                      selectedSubmission === submission.id
                        ? 'bg-yellow-500 text-white'
                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                    }`}
                  >
                    {selectedSubmission === submission.id ? '展開批註' : '查看教師批註'}
                  </button>

                  {/* 批註展示 */}
                  {selectedSubmission === submission.id && notes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h3 className="font-semibold text-gray-700 mb-3">教師觀摩指導</h3>
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <div key={note.id} className="bg-yellow-50 p-4 rounded border border-yellow-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-700">
                                  {note.users?.display_name}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {note.users?.email}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500">
                                {formatTaipeiDateTime(note.created_at)}
                              </p>
                            </div>
                            <p className="text-gray-700 mt-3 whitespace-pre-wrap">
                              {note.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSubmission === submission.id && notes.length === 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-gray-600 italic">暫無教師批註</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
