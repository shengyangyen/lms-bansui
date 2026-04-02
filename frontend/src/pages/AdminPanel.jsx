import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import api from '../api';

function TabBtn({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded font-semibold transition ${
        active
          ? 'border-2 border-primary text-primary bg-primary-light'
          : 'border border-gray-300 text-gray-700 hover:border-primary hover:text-primary'
      }`}
    >
      {label}
    </button>
  );
}

export default function AdminPanel() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const isAdmin = user?.user_role === 'admin';
  const [courses, setCourses] = useState([]);
  const [activeTab, setActiveTab] = useState('courses');
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [selectedCourseForEnroll, setSelectedCourseForEnroll] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [enrollStudentsLoading, setEnrollStudentsLoading] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingUsersLoading, setPendingUsersLoading] = useState(false);
  const [selectedUserForApproval, setSelectedUserForApproval] = useState(null);
  const [selectedRole, setSelectedRole] = useState('student');
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [approvedUsersLoading, setApprovedUsersLoading] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({
    display_name: '',
    real_name: '',
    email: '',
    user_role: 'student'
  });
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(null);
  const [usersWithLevels, setUsersWithLevels] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [selectedUserForExp, setSelectedUserForExp] = useState(null);
  const [expEditValue, setExpEditValue] = useState('');
  const [savingExp, setSavingExp] = useState(false);
  const [expRoleFilter, setExpRoleFilter] = useState('all'); // 'all' | 'students'
  const [notifUserId, setNotifUserId] = useState('');
  const [notifBulkMode, setNotifBulkMode] = useState(false); // true = 群發給全部學員（不含共學之友）
  const [notifMessage, setNotifMessage] = useState('');
  const [notifAddExp, setNotifAddExp] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(null);
  const [excelDownloading, setExcelDownloading] = useState(null);
  const [contactMessages, setContactMessages] = useState([]);
  const [contactMessagesLoading, setContactMessagesLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [adminBadges, setAdminBadges] = useState([]);
  const [badgeAwardUserId, setBadgeAwardUserId] = useState('');
  const [badgeAwardBadgeId, setBadgeAwardBadgeId] = useState('');
  const [badgeAwarding, setBadgeAwarding] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardToggling, setLeaderboardToggling] = useState(false);

  useEffect(() => {
    if (user?.user_role !== 'admin' && user?.user_role !== 'instructor') {
      navigate('/');
    }
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

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/courses', newCourse);
      setNewCourse({ title: '', description: '' });
      fetchCourses();
    } catch (error) {
      console.error('建立課程失敗', error);
    }
  };

  const fetchEnrollmentData = async (courseId) => {
    try {
      setEnrollStudentsLoading(true);
      const [studentsRes, enrolledRes] = await Promise.all([
        api.get('/users/list'),
        api.get(`/courses/${courseId}/enrollments`)
      ]);
      
      const enrolledIds = new Set(enrolledRes.data.map(e => e.student_id));
      setAvailableStudents(studentsRes.data.filter(s => !enrolledIds.has(s.id)));
      setEnrolledStudents(enrolledRes.data);
      setSelectedCourseForEnroll(courseId);
    } catch (error) {
      console.error('取得學生資料失敗', error);
    } finally {
      setEnrollStudentsLoading(false);
    }
  };

  const handleEnrollStudent = async (studentId) => {
    try {
      await api.post(`/courses/${selectedCourseForEnroll}/enroll-student`, { studentId });
      fetchEnrollmentData(selectedCourseForEnroll);
      alert('學生已加入');
    } catch (error) {
      console.error('加入失敗', error);
      alert(error.response?.data?.error || '加入失敗');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!confirm('確認移除此學生？')) return;
    try {
      await api.delete(`/courses/${selectedCourseForEnroll}/enroll-student/${studentId}`);
      fetchEnrollmentData(selectedCourseForEnroll);
      alert('學生已移除');
    } catch (error) {
      console.error('移除失敗', error);
      alert('移除失敗');
    }
  };

  const handleDeleteCourse = async (courseId, title) => {
    if (!confirm(`確定要永久刪除課程「${title}」？\n將一併刪除教材、作業、繳交與討論，無法復原。`)) return;
    try {
      await api.delete(`/courses/${courseId}`);
      if (selectedCourseForEnroll === courseId) setSelectedCourseForEnroll(null);
      fetchCourses();
      alert('課程已刪除');
    } catch (error) {
      console.error('刪除課程失敗', error);
      alert(error.response?.data?.error || '刪除失敗，請稍後再試或至資料庫手動清理');
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setPendingUsersLoading(true);
      const { data } = await api.get('/admin/pending-users');
      setPendingUsers(data);
    } catch (error) {
      console.error('取得待審核用戶失敗', error);
    } finally {
      setPendingUsersLoading(false);
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      await api.post(`/admin/approve-user/${userId}`, { userRole: selectedRole });
      alert('用戶已批准');
      setSelectedUserForApproval(null);
      setSelectedRole('student');
      fetchPendingUsers();
    } catch (error) {
      console.error('批准失敗', error);
      alert(error.response?.data?.error || '批准失敗');
    }
  };

  const handleRejectUser = async (userId) => {
    const reason = prompt('拒絕原因（可選）：');
    try {
      await api.post(`/admin/reject-user/${userId}`, { reason });
      alert('用戶已拒絕');
      fetchPendingUsers();
    } catch (error) {
      console.error('拒絕失敗', error);
      alert('拒絕失敗');
    }
  };

  const fetchApprovedUsers = async () => {
    try {
      setApprovedUsersLoading(true);
      const { data } = await api.get('/admin/users');
      setApprovedUsers(data);
    } catch (error) {
      console.error('取得用戶失敗', error);
    } finally {
      setApprovedUsersLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setSelectedUserForEdit(user.id);
    setEditFormData({
      display_name: user.display_name,
      real_name: user.real_name,
      email: user.email,
      user_role: user.user_role
    });
  };

  const handleSaveUser = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}`, editFormData);
      alert('用戶已更新');
      setSelectedUserForEdit(null);
      fetchApprovedUsers();
    } catch (error) {
      console.error('更新失敗', error);
      alert(error.response?.data?.error || '更新失敗');
    }
  };

  const handleResetPassword = async (userId) => {
    if (!newPassword || newPassword.length < 6) {
      alert('新密碼至少 6 個字');
      return;
    }
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { newPassword });
      alert('密碼已重設');
      setShowPasswordModal(null);
      setNewPassword('');
    } catch (error) {
      console.error('重設失敗', error);
      alert('重設失敗');
    }
  };

  const fetchUsersWithLevels = async () => {
    try {
      setLevelsLoading(true);
      const { data } = await api.get(`/admin/experience-levels?t=${Date.now()}`);
      setUsersWithLevels(data || []);
    } catch (error) {
      console.error('取得用戶等級失敗', error);
      const msg = error.response?.data?.error || error.response?.status === 403 ? '無權限（需 admin 或 instructor）' : error.message;
      alert(`載入失敗：${msg}`);
    } finally {
      setLevelsLoading(false);
    }
  };

  const handleSaveExp = async (userId) => {
    const val = parseInt(expEditValue, 10);
    if (isNaN(val) || val <= 0) {
      alert('請輸入要增加的正整數經驗值');
      return;
    }
    setSavingExp(true);
    try {
      const { data } = await api.patch(`/admin/experience/${userId}`, { addExp: val });
      const added = data?.added ?? val;
      const newTotal = data?.totalExp ?? (usersWithLevels.find(u => u.id === userId)?.total_exp ?? 0) + added;
      const newLevel = data?.level ?? Math.floor(newTotal / 100) + 1;
      setUsersWithLevels(prev => prev.map(u =>
        u.id === userId ? { ...u, total_exp: newTotal, level: newLevel } : u
      ));
      alert(`已增加 ${added} 經驗值（總計 ${newTotal}）`);
      setSelectedUserForExp(null);
      setExpEditValue('');
      fetchUsersWithLevels();
    } catch (error) {
      console.error('增加經驗值失敗', error);
      const msg = error.response?.data?.error || error.message;
      alert(`失敗：${msg}`);
    } finally {
      setSavingExp(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifMessage.trim()) {
      alert('請填寫訊息');
      return;
    }
    if (!notifBulkMode && !notifUserId) {
      alert('請選擇學員');
      return;
    }
    setSendingNotif(true);
    try {
      const payload = {
        message: notifMessage.trim(),
        addExp: parseInt(notifAddExp, 10) || 0
      };
      if (notifBulkMode) {
        payload.target = 'all_students';
      } else {
        payload.userId = notifUserId;
      }
      const { data } = await api.post('/admin/activity-notifications', payload);
      if (data?.success !== undefined) {
        alert(`已發送給 ${data.success} 位學員${data.failed > 0 ? `，${data.failed} 位失敗` : ''}`);
      } else {
        alert('動態通知已發送');
      }
      setNotifMessage('');
      setNotifAddExp('');
    } catch (error) {
      alert(error.response?.data?.error || '發送失敗');
    } finally {
      setSendingNotif(false);
    }
  };

  const notifTargetStudents = usersWithLevels.filter((u) => ['student', 'trainee'].includes(u.user_role));

  const handleReplyMessage = async (messageId) => {
    if (!replyContent.trim()) return;
    setReplySaving(true);
    try {
      await api.patch(`/admin/contact-messages/${messageId}/reply`, { reply: replyContent.trim() });
      setReplyingTo(null);
      setReplyContent('');
      fetchContactMessages();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '回覆失敗';
      console.error('回覆失敗:', err.response?.data || err);
      alert(msg);
    } finally {
      setReplySaving(false);
    }
  };

  const fetchContactMessages = async () => {
    try {
      setContactMessagesLoading(true);
      const { data } = await api.get('/admin/contact-messages');
      setContactMessages(data || []);
    } catch {
      setContactMessages([]);
    } finally {
      setContactMessagesLoading(false);
    }
  };

  const fetchAdminBadges = async () => {
    try {
      const { data } = await api.get('/admin/badges');
      setAdminBadges(data || []);
    } catch {
      setAdminBadges([]);
    }
  };

  const handleAwardBadge = async () => {
    if (!badgeAwardUserId || !badgeAwardBadgeId) return;
    setBadgeAwarding(true);
    try {
      await api.post('/admin/badges/award', { userId: badgeAwardUserId, badgeId: badgeAwardBadgeId });
      alert('徽章已頒發');
      setBadgeAwardUserId('');
      setBadgeAwardBadgeId('');
    } catch (err) {
      alert(err.response?.data?.error || '頒發失敗');
    } finally {
      setBadgeAwarding(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data } = await api.get('/admin/leaderboard');
      setLeaderboardVisible(data.visible);
      setLeaderboardData(data.data);
    } catch {
      setLeaderboardData(null);
    }
  };

  const handleToggleLeaderboard = async () => {
    setLeaderboardToggling(true);
    try {
      const { data } = await api.patch('/admin/leaderboard/visible', { visible: !leaderboardVisible });
      setLeaderboardVisible(data.visible);
      alert(data.visible ? '排行榜已開放' : '排行榜已關閉');
    } catch (err) {
      alert(err.response?.data?.error || '更新失敗');
    } finally {
      setLeaderboardToggling(false);
    }
  };

  const handleDownloadActivities = (userId, format) => {
    const setter = format === 'pdf' ? setPdfDownloading : setExcelDownloading;
    setter(userId);
    const token = useStore.getState().token;
    const pathExt = format === 'pdf' ? 'pdf' : 'excel';
    const fileExt = format === 'pdf' ? 'pdf' : 'xlsx';
    fetch(`/api/admin/users/${userId}/activities/export/${pathExt}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `學員動態-${userId.slice(0, 8)}.${fileExt}`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('下載失敗'))
      .finally(() => setter(null));
  };

  return (
    <div className="page-container min-h-screen">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-2">
          <h1 className="font-heading text-lg sm:text-2xl font-bold text-primary">管理面板</h1>
          <div className="flex items-center gap-6">
            <span className="font-body text-sm text-gray-700">{user?.display_name || user?.real_name}</span>
            <button
              onClick={() => navigate('/')}
              className="font-heading font-semibold px-4 py-2 rounded-md border-2 border-primary text-primary hover:bg-primary-light transition"
            >
              返回主頁
            </button>
            <button
              onClick={logout}
              className="border-2 border-red-300 text-red-700 hover:bg-red-50 px-4 py-2 rounded font-semibold transition"
            >
              登出
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:py-12 px-3 sm:px-4">
        {/* 導航分組 */}
        <div className="mb-8 space-y-5">
          {/* 課程相關 */}
          <div className="p-4 rounded-lg bg-gray-50/80 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">課程與教材</p>
            <div className="flex gap-2 flex-wrap">
              <TabBtn active={activeTab === 'courses'} onClick={() => { setActiveTab('courses'); }} label="課程管理" />
              <TabBtn active={false} onClick={() => navigate('/admin/materials')} label="教材管理" />
              <TabBtn active={false} onClick={() => navigate('/admin/assignments')} label="作業管理" />
            </div>
          </div>
          {/* 用戶相關 */}
          <div className="p-4 rounded-lg bg-gray-50/80 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">用戶與帳號</p>
            <div className="flex gap-2 flex-wrap">
              <TabBtn active={activeTab === 'users'} onClick={() => { setActiveTab('users'); }} label="用戶管理" />
              <TabBtn active={activeTab === 'approval'} onClick={() => { setActiveTab('approval'); fetchPendingUsers(); }} label="帳號審核" />
            </div>
          </div>
          {/* 學員激勵 */}
          <div className="p-4 rounded-lg bg-gray-50/80 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">學員激勵</p>
            <div className="flex gap-2 flex-wrap">
              <TabBtn active={activeTab === 'experience'} onClick={() => { setActiveTab('experience'); fetchUsersWithLevels(); }} label="經驗值管理" />
              <TabBtn active={activeTab === 'badges'} onClick={() => { setActiveTab('badges'); fetchAdminBadges(); fetchUsersWithLevels(); }} label="頒發徽章" />
              <TabBtn active={activeTab === 'leaderboard'} onClick={() => { setActiveTab('leaderboard'); fetchLeaderboard(); }} label="排行榜" />
              <TabBtn active={activeTab === 'notifications'} onClick={() => { setActiveTab('notifications'); fetchUsersWithLevels(); }} label="動態通知" />
            </div>
          </div>
          {/* 學員訊息 */}
          <div className="p-4 rounded-lg bg-gray-50/80 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">學員互動</p>
            <div className="flex gap-2 flex-wrap">
              <TabBtn active={activeTab === 'messages'} onClick={() => { setActiveTab('messages'); fetchContactMessages(); }} label="學員訊息" />
            </div>
          </div>
        </div>

        {activeTab === 'courses' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">課程管理</h2>
            
            <form onSubmit={handleCreateCourse} className="bg-white p-8 rounded-lg shadow mb-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800">建立新課程</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="課程名稱"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <textarea
                  placeholder="課程描述"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows="4"
                />
                <button
                  type="submit"
                  className="font-bold py-2 px-6 rounded-lg border-2 border-primary text-primary hover:bg-primary-light transition"
                >
                  建立課程
                </button>
              </div>
            </form>

            {loading ? (
              <div className="text-center text-gray-600">載入中...</div>
            ) : courses.length === 0 ? (
              <div className="text-center text-gray-600">還沒有任何課程</div>
            ) : (
              <div className="grid gap-4">
                {courses.map((course) => (
                  <div key={course.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{course.title}</h3>
                    <p className="text-gray-600 mb-4">{course.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      <button className="border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded text-sm font-semibold transition">
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(course.id, course.title)}
                        className="border-2 border-red-300 text-red-700 hover:bg-red-50 px-4 py-2 rounded text-sm font-semibold transition"
                      >
                        刪除
                      </button>
                      <button 
                        onClick={() => navigate(`/admin/materials/${course.id}`)}
                        className="border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded text-sm font-semibold transition"
                      >
                        管理教材
                      </button>
                      <button 
                        onClick={() => fetchEnrollmentData(course.id)}
                        className="border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded text-sm font-semibold transition"
                      >
                        管理學生
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">用戶管理</h2>
              <button
                onClick={fetchApprovedUsers}
                disabled={approvedUsersLoading}
                className="border-2 border-primary text-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold transition"
              >
                重新載入
              </button>
            </div>

            {approvedUsersLoading ? (
              <div className="text-center py-8 text-gray-600">載入中...</div>
            ) : approvedUsers.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-gray-600 text-lg">沒有已批准的用戶</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white rounded-lg shadow -mx-3 sm:mx-0">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">暱稱</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">真實姓名</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">信箱</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">角色</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">動作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-800">{user.display_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.real_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.user_role}</td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="border border-primary text-primary hover:bg-primary-light px-3 py-1 rounded text-xs font-semibold transition"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => setShowPasswordModal(user.id)}
                            className="border border-gray-400 text-gray-700 hover:bg-gray-50 px-3 py-1 rounded text-xs font-semibold transition"
                          >
                            重設密碼
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'approval' && isAdmin && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">帳號審核</h2>
              <button
                onClick={fetchPendingUsers}
                disabled={pendingUsersLoading}
                className="border-2 border-primary text-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold transition"
              >
                重新載入
              </button>
            </div>
            
            {pendingUsersLoading ? (
              <div className="text-center py-8 text-gray-600">載入中...</div>
            ) : pendingUsers.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-gray-600 text-lg">沒有待審核的帳號</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="bg-white p-6 rounded-lg shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{user.display_name}</h3>
                        <p className="text-gray-600">真實姓名：{user.real_name}</p>
                        <p className="text-gray-600">信箱：{user.email}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          申請時間：{new Date(user.created_at).toLocaleString('zh-TW')}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                        user.email_verified ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-600 bg-gray-50'
                      }`}>
                        {user.email_verified ? '信箱已驗證' : '待驗證'}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedUserForApproval(user.id)}
                        className="border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded font-semibold transition"
                      >
                        批准
                      </button>
                      <button
                        onClick={() => handleRejectUser(user.id)}
                        className="border-2 border-red-300 text-red-700 hover:bg-red-50 px-4 py-2 rounded font-semibold transition"
                      >
                        拒絕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'experience' && isAdmin && (
          <div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">經驗值管理</h2>
              <div className="flex gap-2 items-center">
                <select
                  value={expRoleFilter}
                  onChange={(e) => setExpRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="all">全部用戶</option>
                  <option value="students">僅學員</option>
                </select>
                <button
                  onClick={fetchUsersWithLevels}
                  disabled={levelsLoading}
                  className="border-2 border-primary text-primary hover:bg-primary-light disabled:opacity-50 px-4 py-2 rounded font-semibold transition"
                >
                  重新載入
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">僅顯示已審核通過的帳號。若學員未出現，請先在「帳號審核」分頁批准。</p>
            {levelsLoading ? (
              <div className="text-center py-8 text-gray-600">載入中...</div>
            ) : (
              <div className="overflow-x-auto bg-white rounded-lg shadow -mx-3 sm:mx-0">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">暱稱</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">真實姓名</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">信箱</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">角色</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">等級</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">總經驗值</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">動作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(expRoleFilter === 'students'
                      ? usersWithLevels.filter(u => ['student', 'trainee', 'study_buddy'].includes(u.user_role))
                      : usersWithLevels
                    ).map((u) => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-800">{u.display_name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{u.real_name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{u.user_role || '-'}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-primary">Lv.{u.level}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{u.total_exp}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserForExp(u.id);
                                setExpEditValue('');
                              }}
                              className="border border-primary text-primary hover:bg-primary-light px-3 py-1 rounded text-xs font-semibold transition"
                            >
                              加經驗
                            </button>
                            <button
                              onClick={() => handleDownloadActivities(u.id, 'pdf')}
                              disabled={pdfDownloading === u.id}
                              className="border border-gray-400 text-gray-600 hover:bg-gray-50 px-3 py-1 rounded text-xs font-semibold transition disabled:opacity-50"
                            >
                              {pdfDownloading === u.id ? '...' : 'PDF'}
                            </button>
                            <button
                              onClick={() => handleDownloadActivities(u.id, 'excel')}
                              disabled={excelDownloading === u.id}
                              className="border border-gray-400 text-gray-600 hover:bg-gray-50 px-3 py-1 rounded text-xs font-semibold transition disabled:opacity-50"
                            >
                              {excelDownloading === u.id ? '...' : 'Excel'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && isAdmin && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">排行榜管理</h2>
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-800">排行榜可見狀態</p>
                  <p className="text-sm text-gray-500 mt-1">關閉時，學員無法看到排行榜入口與內容</p>
                </div>
                <button
                  onClick={handleToggleLeaderboard}
                  disabled={leaderboardToggling}
                  className={`px-6 py-2 rounded font-semibold transition ${
                    leaderboardVisible
                      ? 'bg-amber-100 text-amber-800 border-2 border-amber-300 hover:bg-amber-200'
                      : 'bg-green-100 text-green-800 border-2 border-green-300 hover:bg-green-200'
                  }`}
                >
                  {leaderboardToggling ? '更新中...' : leaderboardVisible ? '點擊關閉' : '點擊開放'}
                </button>
              </div>
              <p className="text-sm text-gray-600">
                目前狀態：<strong>{leaderboardVisible ? '學員可見' : '學員不可見'}</strong>
              </p>
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-4">即時排行榜預覽</h3>
            {!leaderboardData ? (
              <div className="text-gray-500">載入中...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h4 className="font-bold text-gray-800 mb-3">經驗值總數</h4>
                  <ul className="space-y-1 text-sm">
                    {(leaderboardData.exp || []).slice(0, 5).map((r, i) => (
                      <li key={i}>#{r.rank} {r.name} — {r.value}</li>
                    ))}
                    {(leaderboardData.exp || []).length === 0 && <li className="text-gray-500">尚無資料</li>}
                  </ul>
                </div>
                <div className="card">
                  <h4 className="font-bold text-gray-800 mb-3">徽章蒐集數</h4>
                  <ul className="space-y-1 text-sm">
                    {(leaderboardData.badges || []).slice(0, 5).map((r, i) => (
                      <li key={i}>#{r.rank} {r.name} — {r.value} 枚</li>
                    ))}
                    {(leaderboardData.badges || []).length === 0 && <li className="text-gray-500">尚無資料</li>}
                  </ul>
                </div>
                <div className="card">
                  <h4 className="font-bold text-gray-800 mb-3">優良作業數</h4>
                  <ul className="space-y-1 text-sm">
                    {(leaderboardData.excellent || []).slice(0, 5).map((r, i) => (
                      <li key={i}>#{r.rank} {r.name} — {r.value} 次</li>
                    ))}
                    {(leaderboardData.excellent || []).length === 0 && <li className="text-gray-500">尚無資料</li>}
                  </ul>
                </div>
                <div className="card">
                  <h4 className="font-bold text-gray-800 mb-3">討論回饋數</h4>
                  <ul className="space-y-1 text-sm">
                    {(leaderboardData.comments || []).slice(0, 5).map((r, i) => (
                      <li key={i}>#{r.rank} {r.name} — {r.value} 則</li>
                    ))}
                    {(leaderboardData.comments || []).length === 0 && <li className="text-gray-500">尚無資料</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && isAdmin && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">頒發徽章</h2>
            <p className="text-sm text-gray-500 mb-4">手動頒發徽章給學員，可同時增加經驗值。</p>
            <div className="bg-white p-6 rounded-lg shadow max-w-xl">
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">選擇學員</label>
                  <select
                    value={badgeAwardUserId}
                    onChange={(e) => setBadgeAwardUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">-- 請選擇 --</option>
                    {usersWithLevels.filter(u => ['student', 'trainee', 'study_buddy'].includes(u.user_role)).map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name || u.real_name || u.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">選擇徽章</label>
                  <select
                    value={badgeAwardBadgeId}
                    onChange={(e) => setBadgeAwardBadgeId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">-- 請選擇 --</option>
                    {adminBadges.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}（+{b.exp_amount} 經驗值）</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAwardBadge}
                  disabled={badgeAwarding || !badgeAwardUserId || !badgeAwardBadgeId}
                  className="border-2 border-primary text-primary hover:bg-primary-light px-6 py-2 rounded font-semibold transition disabled:opacity-50"
                >
                  {badgeAwarding ? '頒發中...' : '頒發徽章'}
                </button>
              </div>
            </div>
            {usersWithLevels.length === 0 && (
              <p className="text-gray-500 mt-4">請先在「經驗值管理」載入學員列表。</p>
            )}
          </div>
        )}

        {activeTab === 'notifications' && isAdmin && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">發送動態通知</h2>
            <p className="text-sm text-gray-500 mb-4">發送通知給學員，可作為上課紀錄或群體訊息，可選擇是否同時增加經驗值。群發不含共學之友。</p>
            <div className="bg-white p-6 rounded-lg shadow max-w-xl">
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">發送對象</label>
                  <div className="flex gap-6 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="notifMode"
                        checked={!notifBulkMode}
                        onChange={() => setNotifBulkMode(false)}
                      />
                      <span>單一學員</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="notifMode"
                        checked={notifBulkMode}
                        onChange={() => setNotifBulkMode(true)}
                      />
                      <span>群發給全部學員（{notifTargetStudents.length} 人，不含共學之友）</span>
                    </label>
                  </div>
                  {!notifBulkMode && (
                    <select
                      value={notifUserId}
                      onChange={(e) => setNotifUserId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">-- 請選擇 --</option>
                      {usersWithLevels.filter(u => ['student', 'trainee', 'study_buddy'].includes(u.user_role)).map((u) => (
                        <option key={u.id} value={u.id}>{u.display_name || u.real_name || u.email}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">通知內容</label>
                  <textarea
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    placeholder="例：恭喜完成本週學習任務！"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">同時增加經驗值（選填，0 則不加）</label>
                  <input
                    type="number"
                    min="0"
                    value={notifAddExp}
                    onChange={(e) => setNotifAddExp(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleSendNotification}
                  disabled={sendingNotif || !notifMessage.trim() || (!notifBulkMode && !notifUserId)}
                  className="border-2 border-primary text-primary hover:bg-primary-light px-6 py-2 rounded font-semibold transition disabled:opacity-50"
                >
                  {sendingNotif ? '發送中...' : notifBulkMode ? `群發給 ${notifTargetStudents.length} 位學員` : '發送通知'}
                </button>
              </div>
            </div>
            {usersWithLevels.length === 0 && (
              <p className="text-gray-500 mt-4">請先在「經驗值管理」載入學員列表。</p>
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">學員私訊</h2>
            <p className="text-sm text-gray-500 mb-4">學員透過「訊息聯絡」發送的私訊。</p>
            {contactMessagesLoading ? (
              <div className="text-center py-8 text-gray-600">載入中...</div>
            ) : contactMessages.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-500">尚無學員訊息</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contactMessages.map((m) => (
                  <div key={m.id} className="card">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-gray-800">{m.from_name}</span>
                      <span className="text-gray-500 text-sm">{m.created_at ? new Date(m.created_at).toLocaleString('zh-TW') : ''}</span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{m.content}</p>
                    {m.reply_content && (
                      <div className="mt-4 pt-4 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
                        <p className="text-sm font-semibold text-primary mb-1">管理者回覆</p>
                        <p className="text-gray-700 whitespace-pre-wrap text-sm">{m.reply_content}</p>
                        <p className="text-gray-500 text-xs mt-1">{m.reply_at ? new Date(m.reply_at).toLocaleString('zh-TW') : ''}</p>
                      </div>
                    )}
                    {!m.reply_content && (
                      <div className="mt-4">
                        {replyingTo === m.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="輸入回覆內容..."
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                              rows="3"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReplyMessage(m.id)}
                                disabled={replySaving || !replyContent.trim()}
                                className="border-2 border-primary text-primary hover:bg-primary-light px-4 py-1 rounded text-sm font-semibold disabled:opacity-50"
                              >
                                {replySaving ? '發送中...' : '送出回覆'}
                              </button>
                              <button
                                onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                                className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-1 rounded text-sm"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingTo(m.id)}
                            className="border border-primary text-primary hover:bg-primary-light px-3 py-1 rounded text-sm font-semibold"
                          >
                            回覆
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedUserForApproval && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">設定角色並批准</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">選擇角色 *</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="student">學員</option>
                    <option value="trainee">伴飛學員</option>
                    <option value="study_buddy">共學之友</option>
                    <option value="flight_instructor">飛行導師</option>
                    <option value="instructor">導師</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleApproveUser(selectedUserForApproval)}
                    className="flex-1 border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded font-semibold transition"
                  >
                    確認批准
                  </button>
                  <button
                    onClick={() => setSelectedUserForApproval(null)}
                    className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded font-semibold transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedUserForEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-96 overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">編輯用戶</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">暱稱</label>
                  <input
                    type="text"
                    value={editFormData.display_name}
                    onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">真實姓名</label>
                  <input
                    type="text"
                    value={editFormData.real_name}
                    onChange={(e) => setEditFormData({ ...editFormData, real_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">信箱</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">角色</label>
                  <select
                    value={editFormData.user_role}
                    onChange={(e) => setEditFormData({ ...editFormData, user_role: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="student">學員</option>
                    <option value="trainee">伴飛學員</option>
                    <option value="study_buddy">共學之友</option>
                    <option value="flight_instructor">飛行導師</option>
                    <option value="instructor">導師</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleSaveUser(selectedUserForEdit)}
                    className="flex-1 border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded font-semibold transition"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setSelectedUserForEdit(null)}
                    className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded font-semibold transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">重設密碼</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">新密碼 *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 6 個字"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleResetPassword(showPasswordModal)}
                    className="flex-1 border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded font-semibold transition"
                  >
                    確認重設
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordModal(null);
                      setNewPassword('');
                    }}
                    className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded font-semibold transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedCourseForEnroll && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  {courses.find(c => c.id === selectedCourseForEnroll)?.title} - 管理學生
                </h2>
                <button
                  onClick={() => setSelectedCourseForEnroll(null)}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1 rounded font-semibold transition"
                >
                  關閉
                </button>
              </div>

              {enrollStudentsLoading ? (
                <div className="text-center py-8 text-gray-600">載入中...</div>
              ) : (
                <div className="space-y-6">
                  {/* 已註冊的學生 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      已註冊學生 ({enrolledStudents.length})
                    </h3>
                    {enrolledStudents.length === 0 ? (
                      <p className="text-gray-600 text-sm">尚無學生</p>
                    ) : (
                      <div className="space-y-2">
                        {enrolledStudents.map((enrollment) => (
                          <div key={enrollment.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                            <div>
                              <p className="font-semibold text-gray-800">{enrollment.users.full_name}</p>
                              <p className="text-sm text-gray-600">{enrollment.users.email}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveStudent(enrollment.student_id)}
                              className="border-2 border-red-300 text-red-700 hover:bg-red-50 px-3 py-1 rounded text-sm font-semibold transition"
                            >
                              移除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 可新增的學生 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      可新增學生 ({availableStudents.length})
                    </h3>
                    {availableStudents.length === 0 ? (
                      <p className="text-gray-600 text-sm">所有學生都已加入或沒有學生帳號</p>
                    ) : (
                      <div className="space-y-2">
                        {availableStudents.map((student) => (
                          <div key={student.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                            <div>
                              <p className="font-semibold text-gray-800">{student.full_name}</p>
                              <p className="text-sm text-gray-600">{student.email}</p>
                            </div>
                            <button
                              onClick={() => handleEnrollStudent(student.id)}
                              className="border-2 border-primary text-primary hover:bg-primary-light px-3 py-1 rounded text-sm font-semibold transition"
                            >
                              加入
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedUserForExp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">增加經驗值</h2>
              <p className="text-sm text-gray-600 mb-4">
                用戶：{usersWithLevels.find(u => u.id === selectedUserForExp)?.display_name || usersWithLevels.find(u => u.id === selectedUserForExp)?.email}
                （目前 {usersWithLevels.find(u => u.id === selectedUserForExp)?.total_exp ?? 0}）
              </p>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">增加經驗值（正整數）</label>
                <input
                  type="number"
                  min="1"
                  placeholder="例：50"
                  value={expEditValue}
                  onChange={(e) => setExpEditValue(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveExp(selectedUserForExp)}
                  disabled={savingExp || !expEditValue.trim()}
                  className="flex-1 border-2 border-primary text-primary hover:bg-primary-light px-4 py-2 rounded font-semibold transition disabled:opacity-50"
                >
                  {savingExp ? '處理中...' : '增加'}
                </button>
                <button
                  onClick={() => { setSelectedUserForExp(null); setExpEditValue(''); }}
                  className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded font-semibold transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
