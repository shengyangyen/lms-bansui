import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function EditAssignment() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    designatedStudentIds: []
  });
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      const [assignmentRes, enrollmentsRes] = await Promise.all([
        api.get(`/assignments/${assignmentId}`),
        api.get(`/courses/${assignmentId}/enrollments`)
      ]);

      setAssignment(assignmentRes.data);
      setFormData({
        title: assignmentRes.data.title,
        description: assignmentRes.data.description || '',
        designatedStudentIds: []
      });

      // 這裡需要先獲取課程 ID，然後查詢該課程的已註冊學生
      const courseId = assignmentRes.data.course_id;
      const enrollmentsRes2 = await api.get(`/courses/${courseId}/enrollments`);
      setEnrolledStudents(enrollmentsRes2.data);

      // 檢查現有的指定學生
      const { data: designations } = await api.get(`/assignments/${assignmentId}/designations`);
      if (designations) {
        setFormData(prev => ({
          ...prev,
          designatedStudentIds: designations.map(d => d.student_id)
        }));
      }
    } catch (error) {
      console.error('取得資料失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.patch(`/assignments/${assignmentId}`, formData);
      alert('作業已更新');
      navigate(-1);
    } catch (error) {
      console.error('更新失敗', error);
      alert('更新失敗：' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-500 hover:text-blue-700"
          >
            ← 返回
          </button>
          <h1 className="text-2xl font-bold text-purple-600">編輯作業</h1>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-4">
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">作業標題 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">作業描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows="6"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">指定對象</label>
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
                      checked={formData.designatedStudentIds.includes(student.student_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            designatedStudentIds: [...formData.designatedStudentIds, student.student_id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            designatedStudentIds: formData.designatedStudentIds.filter(id => id !== student.student_id)
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

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              {saving ? '保存中...' : '保存變更'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
