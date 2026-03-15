import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import api, { fetchWithAuth } from '../api';
import { formatTaipeiDate, formatTaipeiDateTime } from '../utils/datetime';

export default function AssignmentManagement() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useStore();
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    assignmentType: 'upload',
    questions: [{ title: '', description: '', required: true }],
    designatedStudentIds: []
  });
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionHistories, setSubmissionHistories] = useState({});
  const [expandedHistory, setExpandedHistory] = useState({});
  const [expandedAnswers, setExpandedAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.user_role !== 'admin' && user?.user_role !== 'instructor') {
      navigate('/');
    }
    fetchData();
  }, [courseId]);

  const fetchData = async () => {
    try {
      const results = await Promise.allSettled([
        api.get(`/courses/${courseId}`),
        api.get(`/courses/${courseId}/assignments`),
        api.get(`/courses/${courseId}/enrollments`)
      ]);
      
      if (results[0].status === 'fulfilled') {
        setCourse(results[0].value.data.course);
      } else {
        console.error('取得課程失敗', results[0].reason);
      }
      
      if (results[1].status === 'fulfilled') {
        setAssignments(results[1].value.data);
      } else {
        console.error('取得作業失敗', results[1].reason);
      }
      
      if (results[2].status === 'fulfilled') {
        setEnrolledStudents(results[2].value.data);
      } else {
        console.error('取得學生名單失敗', results[2].reason);
      }
    } catch (error) {
      console.error('取得資料失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (creatingAssignment) return;

    const isForm = newAssignment.assignmentType === 'form';
    if (isForm) {
      const validQuestions = newAssignment.questions.filter(
        (q) => String(q.title || '').trim() !== ''
      );
      if (validQuestions.length === 0) {
        alert('請至少新增一題且填寫題目標題');
        return;
      }
    }

    setCreatingAssignment(true);
    try {
      // 若是檔案上傳型，不傳 questions；若是填空題才傳
      const payloadData = isForm 
        ? newAssignment 
        : {
            title: newAssignment.title,
            description: newAssignment.description,
            assignmentType: newAssignment.assignmentType,
            designatedStudentIds: newAssignment.designatedStudentIds
            // 不包含 questions
          };
      await api.post(`/courses/${courseId}/assignments`, payloadData);
      setNewAssignment({
        title: '',
        description: '',
        assignmentType: 'upload',
        questions: [{ title: '', description: '', required: true }],
        designatedStudentIds: []
      });
      setActiveTab('list');
      fetchData();
      alert('作業建立成功');
    } catch (error) {
      console.error('建立作業失敗', error);
      alert('建立作業失敗：' + (error.response?.data?.error || error.message));
    } finally {
      setCreatingAssignment(false);
    }
  };

  const loadSubmissions = async (assignmentId) => {
    try {
      const target = assignments.find((a) => a.id === assignmentId);
      const endpoint =
        target?.assignment_type === 'form'
          ? `/assignments/${assignmentId}/form-submissions`
          : `/assignments/${assignmentId}/submissions`;
      const { data } = await api.get(endpoint);
      setSubmissions(data || []);
    } catch (error) {
      console.error('載入提交失敗', error);
      setSubmissions([]);
      throw error;
    }
  };

  const handleViewSubmissions = async (assignmentId) => {
    try {
      setSelectedAssignment(assignmentId);
      await loadSubmissions(assignmentId);
      setActiveTab('submissions');
    } catch (error) {
      console.error('取得提交失敗', error);
      alert('取得提交失敗: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleToggleHistory = async (assignmentId, studentId) => {
    const historyKey = `${assignmentId}-${studentId}`;
    const nextExpanded = !expandedHistory[historyKey];

    setExpandedHistory((prev) => ({ ...prev, [historyKey]: nextExpanded }));
    if (!nextExpanded || submissionHistories[historyKey]) {
      return;
    }

    try {
      const target = assignments.find((a) => a.id === assignmentId);
      const endpoint =
        target?.assignment_type === 'form'
          ? `/assignments/${assignmentId}/students/${studentId}/form-submissions-history`
          : `/assignments/${assignmentId}/students/${studentId}/submissions-history`;
      const { data } = await api.get(
        endpoint
      );
      setSubmissionHistories((prev) => ({ ...prev, [historyKey]: data || [] }));
    } catch (error) {
      console.error('取得版本歷程失敗', error);
      alert('取得版本歷程失敗: ' + (error.response?.data?.error || error.message));
    }
  };

  useEffect(() => {
    if (activeTab !== 'submissions') return;
    if (selectedAssignment) return;
    if (!assignments.length) return;

    const firstAssignmentId = assignments[0].id;
    setSelectedAssignment(firstAssignmentId);
    loadSubmissions(firstAssignmentId).catch((error) => {
      console.error('自動載入提交失敗', error);
    });
  }, [activeTab, selectedAssignment, assignments]);

  const handleDeleteAssignment = async (assignmentId) => {
    if (window.confirm('確定要刪除此作業？')) {
      try {
        await api.delete(`/assignments/${assignmentId}`);
        fetchData();
      } catch (error) {
        console.error('刪除失敗', error);
      }
    }
  };

  const updateQuestion = (index, key, value) => {
    setNewAssignment((prev) => {
      const next = [...prev.questions];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, questions: next };
    });
  };

  const addQuestion = () => {
    setNewAssignment((prev) => ({
      ...prev,
      questions: [...prev.questions, { title: '', description: '', required: true }]
    }));
  };

  const removeQuestion = (index) => {
    setNewAssignment((prev) => {
      if (prev.questions.length <= 1) {
        return prev;
      }
      const next = prev.questions.filter((_, i) => i !== index);
      return { ...prev, questions: next };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <button 
              onClick={() => navigate('/admin/materials')}
              className="text-blue-500 hover:text-blue-700 mr-4"
            >
              ← 返回課程列表
            </button>
            <h1 className="text-2xl font-bold text-purple-600 inline">
              {course?.title} - 作業管理
            </h1>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-12 px-4">
        <div className="flex gap-4 mb-8">
          {['list', 'create', 'submissions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded font-semibold transition ${
                activeTab === tab
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab === 'list' ? '作業列表' : tab === 'create' ? '建立作業' : '查看提交'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-600">載入中...</div>
        ) : (
          <>
            {/* 作業列表 */}
            {activeTab === 'list' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-800">作業列表</h2>
                {assignments.length === 0 ? (
                  <div className="text-center text-gray-600 py-12">
                    還沒有任何作業，點擊「建立作業」新增
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">
                              {assignment.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              類型：{assignment.assignment_type === 'form' ? '填空題' : '檔案上傳'}
                            </p>
                            <p className="text-gray-600 mt-2">
                              {assignment.description}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500">
                            建立於 {formatTaipeiDate(assignment.created_at)}
                          </span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => navigate(`/assignments/${assignment.id}/statistics`)}
                            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm"
                          >
                            統計
                          </button>
                          <button
                            onClick={() => handleViewSubmissions(assignment.id)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                          >
                            查看提交 ({assignment.submission_count || 0})
                          </button>
                          <button
                            onClick={() => navigate(`/assignments/${assignment.id}/edit`)}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded text-sm"
                          >
                            ✏️ 編輯
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 建立作業 */}
            {activeTab === 'create' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-800">建立新作業</h2>
                <form
                  onSubmit={handleCreateAssignment}
                  className="bg-white p-8 rounded-lg shadow max-w-2xl"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        作業標題 *
                      </label>
                      <input
                        type="text"
                        placeholder="例如：第一周練習題"
                        value={newAssignment.title}
                        onChange={(e) =>
                          setNewAssignment({ ...newAssignment, title: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        作業描述
                      </label>
                      <textarea
                        placeholder="輸入作業的詳細描述、要求等..."
                        value={newAssignment.description}
                        onChange={(e) =>
                          setNewAssignment({ ...newAssignment, description: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows="6"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        作業類型
                      </label>
                      <select
                        value={newAssignment.assignmentType}
                        onChange={(e) =>
                          setNewAssignment({ ...newAssignment, assignmentType: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="upload">檔案上傳</option>
                        <option value="form">填空題作答</option>
                      </select>
                    </div>

                    {newAssignment.assignmentType === 'upload' && (
                      <div className="p-4 bg-blue-50 rounded border border-blue-200">
                        <p className="text-sm text-blue-700 font-semibold">檔案上傳作業</p>
                        <p className="text-sm text-blue-600 mt-2">
                          學生將透過「提交作業」頁面上傳檔案。你可以在下方設定指定對象，然後點「建立作業」完成。
                        </p>
                      </div>
                    )}

                    {newAssignment.assignmentType === 'form' && (
                      <div className="space-y-3 p-4 bg-gray-50 rounded border">
                        <p className="font-semibold text-gray-700">題目設定</p>
                        {newAssignment.questions.map((q, idx) => (
                          <div key={idx} className="p-3 border rounded bg-white space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-700">題目 {idx + 1}</p>
                              <button
                                type="button"
                                onClick={() => removeQuestion(idx)}
                                disabled={newAssignment.questions.length <= 1}
                                className="text-xs bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white px-2 py-1 rounded"
                              >
                                刪除題目
                              </button>
                            </div>
                            <input
                              type="text"
                              value={q.title}
                              onChange={(e) => updateQuestion(idx, 'title', e.target.value)}
                              placeholder={`題目 ${idx + 1} 標題`}
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                              required
                            />
                            <textarea
                              value={q.description}
                              onChange={(e) => updateQuestion(idx, 'description', e.target.value)}
                              placeholder="題目說明（可選）"
                              rows="2"
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addQuestion}
                          className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1 rounded text-sm"
                        >
                          + 新增題目
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        指定對象
                      </label>
                      <p className="text-sm text-gray-600 mb-3">
                        不選表示指定給全班。選擇特定學生則只有他們看得到此作業。
                      </p>
                      <div className="space-y-2 max-h-60 overflow-y-auto p-4 bg-white border border-gray-300 rounded">
                        {enrolledStudents.length === 0 ? (
                          <p className="text-gray-500 text-sm">沒有已註冊的學生</p>
                        ) : (
                          enrolledStudents.map((student) => (
                            <label key={student.student_id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newAssignment.designatedStudentIds.includes(student.student_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewAssignment({
                                      ...newAssignment,
                                      designatedStudentIds: [...newAssignment.designatedStudentIds, student.student_id]
                                    });
                                  } else {
                                    setNewAssignment({
                                      ...newAssignment,
                                      designatedStudentIds: newAssignment.designatedStudentIds.filter(id => id !== student.student_id)
                                    });
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-700">
                                {student.users?.full_name} ({student.users?.email})
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={creatingAssignment}
                      className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-6 rounded-lg transition w-full"
                    >
                      {creatingAssignment ? '建立中...' : '建立作業'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 查看提交 */}
            {activeTab === 'submissions' && (
              <div>
                <button
                  onClick={() => setActiveTab('list')}
                  className="mb-4 text-blue-600 hover:text-blue-700 font-semibold"
                >
                  ← 返回作業列表
                </button>
                <h2 className="text-2xl font-bold mb-6 text-gray-800">
                  {selectedAssignment
                    ? `${assignments.find((a) => a.id === selectedAssignment)?.title || '作業'} - 學生提交`
                    : '學生提交'}
                </h2>
                {!selectedAssignment ? (
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-700 mb-4">請先選擇一個作業來查看提交。</p>
                    <div className="flex flex-wrap gap-2">
                      {assignments.map((assignment) => (
                        <button
                          key={assignment.id}
                          onClick={() => handleViewSubmissions(assignment.id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                        >
                          {assignment.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : !submissions || submissions.length === 0 ? (
                  <div className="text-center text-gray-600 py-12">
                    還沒有學生提交此作業
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="bg-white p-6 rounded-lg shadow"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">
                              {submission.users?.full_name}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              提交於 {formatTaipeiDateTime(submission.submitted_at)}
                            </p>
                            {submission.version_number > 1 && (
                              <p className="text-sm text-blue-600 mt-1">
                                版本號：{submission.version_number}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${
                              submission.feedback && submission.feedback.length > 0
                                ? 'bg-green-500'
                                : 'bg-yellow-500'
                            }`}
                          >
                            {submission.feedback && submission.feedback.length > 0
                              ? '已批改'
                              : '待批改'}
                          </span>
                        </div>

                        <div className="mb-4">
                          {assignments.find((a) => a.id === selectedAssignment)?.assignment_type === 'form' ? (
                            <div className="flex gap-3">
                              <button
                                onClick={() =>
                                  window.open(`/api/form-submissions/${submission.id}/export/pdf`, '_blank')
                                }
                                className="text-blue-500 hover:text-blue-700 font-semibold"
                              >
                                匯出 PDF
                              </button>
                              <button
                                onClick={() =>
                                  window.open(`/api/form-submissions/${submission.id}/export/excel`, '_blank')
                                }
                                className="text-blue-500 hover:text-blue-700 font-semibold"
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
                              className="text-blue-500 hover:text-blue-700 flex items-center gap-2 font-semibold"
                            >
                              下載提交 ({submission.file_name})
                            </button>
                          )}
                        </div>

                        {assignments.find((a) => a.id === selectedAssignment)?.assignment_type === 'form' &&
                          Array.isArray(submission.resolved_answers) && (
                            <div className="mb-4 p-3 bg-gray-50 rounded border">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-semibold text-gray-700">答案預覽</p>
                                {submission.resolved_answers.length > 2 && (
                                  <button
                                    onClick={() =>
                                      setExpandedAnswers((prev) => ({
                                        ...prev,
                                        [submission.id]: !prev[submission.id]
                                      }))
                                    }
                                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                                  >
                                    {expandedAnswers[submission.id] ? '收合答案' : '展開全部答案'}
                                  </button>
                                )}
                              </div>
                              {submission.resolved_answers
                                .slice(0, expandedAnswers[submission.id] ? submission.resolved_answers.length : 2)
                                .map((item) => (
                                  <p key={item.question_number} className="text-sm text-gray-600 truncate">
                                    題目{item.question_number}（{item.title}）：{String(item.answer || '(空白)')}
                                  </p>
                                ))}
                            </div>
                          )}

                        {submission.feedback && submission.feedback.length > 0 && (
                          <div className="bg-gray-50 p-4 rounded mb-4 border-l-4 border-green-500">
                            <h4 className="font-semibold text-gray-800 mb-2">
                              最新批改反饋
                            </h4>
                            {submission.feedback[submission.feedback.length - 1] && (
                              <div>
                                <p className="text-sm text-gray-600 mb-2">
                                  評分：
                                  <span
                                    className={`font-semibold ml-2 ${
                                      submission.feedback[submission.feedback.length - 1]
                                        .grade === '建議需調整'
                                        ? 'text-red-600'
                                        : submission.feedback[submission.feedback.length - 1]
                                            .grade === '合格'
                                          ? 'text-green-600'
                                          : 'text-blue-600'
                                    }`}
                                  >
                                    {
                                      submission.feedback[submission.feedback.length - 1]
                                        .grade
                                    }
                                  </span>
                                </p>
                                {submission.feedback[submission.feedback.length - 1]
                                  .comment && (
                                  <p className="text-gray-700">
                                    {
                                      submission.feedback[submission.feedback.length - 1]
                                        .comment
                                    }
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() =>
                            navigate(
                              `/admin/submissions/${submission.linked_submission_id || submission.id}/feedback`
                            )
                          }
                          disabled={
                            assignments.find((a) => a.id === selectedAssignment)?.assignment_type ===
                              'form' && !submission.linked_submission_id
                          }
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                        >
                          {submission.feedback && submission.feedback.length > 0
                            ? '編輯批改'
                            : '添加批改'}
                        </button>

                        <button
                          onClick={() =>
                            handleToggleHistory(selectedAssignment, submission.student_id)
                          }
                          className="ml-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                        >
                          {expandedHistory[`${selectedAssignment}-${submission.student_id}`]
                            ? '收合歷程'
                            : '查看版本歷程'}
                        </button>

                        {expandedHistory[`${selectedAssignment}-${submission.student_id}`] && (
                          <div className="mt-4 border-t pt-4">
                            <h4 className="font-semibold text-gray-800 mb-3">提交歷程</h4>
                            {(submissionHistories[
                              `${selectedAssignment}-${submission.student_id}`
                            ] || []).map((historyItem) => (
                              <div
                                key={historyItem.id}
                                className="mb-3 p-3 bg-gray-50 rounded border"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-semibold text-gray-800">
                                    版本 {historyItem.version_number}
                                    {historyItem.is_latest ? '（最新）' : ''}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {formatTaipeiDateTime(historyItem.submitted_at)}
                                  </span>
                                </div>
                                <button
                                  onClick={async () => {
                                    const isForm =
                                      assignments.find((a) => a.id === selectedAssignment)
                                        ?.assignment_type === 'form';
                                    try {
                                      if (isForm) {
                                        window.open(`/api/form-submissions/${historyItem.id}/export/pdf`, '_blank');
                                        return;
                                      }
                                      const res = await fetchWithAuth(`/api/submissions/${historyItem.id}/download`);
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = historyItem.file_name;
                                      link.click();
                                      URL.revokeObjectURL(url);
                                    } catch (e) {
                                      alert('下載失敗');
                                    }
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                                >
                                  {assignments.find((a) => a.id === selectedAssignment)?.assignment_type === 'form'
                                    ? '匯出此版本 PDF'
                                    : `下載此版本（${historyItem.file_name}）`}
                                </button>
                                {historyItem.feedback && historyItem.feedback.length > 0 && (
                                  <div className="mt-2 p-2 bg-white rounded border-l-4 border-green-500">
                                    <p className="text-sm text-gray-700">
                                      最新評分：{historyItem.feedback[historyItem.feedback.length - 1].grade}
                                    </p>
                                    {historyItem.feedback[historyItem.feedback.length - 1].comment && (
                                      <p className="text-sm text-gray-600 mt-1">
                                        {historyItem.feedback[historyItem.feedback.length - 1].comment}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
