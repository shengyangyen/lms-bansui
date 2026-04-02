import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import api from '../api';

export default function CourseAssignmentsList() {
  const { user } = useStore();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={() => navigate('/admin')}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            ← 返回管理面板
          </button>
          <h1 className="text-2xl font-bold text-purple-600">選擇課程管理作業</h1>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-12 px-4">
        {loading ? (
          <div className="text-center text-gray-600">載入中...</div>
        ) : courses.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600">還沒有任何課程，請先在管理面板建立課程</p>
            <button
              onClick={() => navigate('/admin')}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
            >
              返回管理面板
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => navigate(`/admin/assignments/${course.id}`)}
                className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer transform hover:scale-105"
              >
                <h3 className="text-xl font-bold text-gray-800 mb-2">{course.title}</h3>
                <p className="text-gray-600 mb-4">{course.description}</p>
                <div className="flex gap-2">
                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-sm font-semibold">
                    管理作業
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
