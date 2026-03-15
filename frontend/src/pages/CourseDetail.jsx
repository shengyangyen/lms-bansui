import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fetchWithAuth } from '../api';
import { formatTaipeiDate, formatTaipeiDateTime } from '../utils/datetime';
import { renderLinksAsReact } from '../utils/linkParser';

// 提取 YouTube Video ID
const getYouTubeVideoId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [activeTab, setActiveTab] = useState('materials');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [designatedAssignments, setDesignatedAssignments] = useState(new Set());
  const [featuredSubmissions, setFeaturedSubmissions] = useState([]);
  const [selectedFeaturedNotes, setSelectedFeaturedNotes] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchCourse();
    fetchFeaturedSubmissions();
  }, [id]);

  const fetchFeaturedSubmissions = async () => {
    try {
      const { data } = await api.get(`/courses/${id}/featured-submissions`);
      setFeaturedSubmissions(data || []);
    } catch (error) {
      console.error('取得優秀作品失敗', error);
    }
  };

  const fetchCourse = async () => {
    try {
      const token = localStorage.getItem('token');
      let userId = null;
      
      if (token) {
        try {
          const decoded = JSON.parse(atob(token.split('.')[1]));
          userId = decoded.userId;
        } catch (e) {
          console.warn('無法解析 token');
        }
      }
      
      const headers = userId ? { 'x-user-id': userId } : {};
      const { data } = await api.get(`/courses/${id}`, { headers });
      setCourse(data);
      
      // 使用後端回傳的 isDesignatedForUser，避免 N+1 查詢
      if (data.assignments) {
        const designated = new Set();
        data.assignments.forEach(assignment => {
          if (assignment.isDesignatedForUser) {
            designated.add(assignment.id);
          }
        });
        setDesignatedAssignments(designated);
      }
    } catch (error) {
      console.error('取得課程失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    try {
      const commentContent = replyingTo ? replyText : newComment;
      if (!commentContent.trim()) {
        alert('留言內容不能為空');
        return;
      }

      await api.post(`/courses/${id}/comments`, {
        content: commentContent,
        parentCommentId: replyingTo || undefined
      });

      setNewComment('');
      setReplyText('');
      setReplyingTo(null);
      fetchCourse();
    } catch (error) {
      console.error('提交留言失敗', error);
    }
  };

  const handleViewFeaturedNotes = async (submissionId) => {
    try {
      const { data } = await api.get(`/submissions/${submissionId}/featured-notes`);
      setSelectedFeaturedNotes(prev => ({
        ...prev,
        [submissionId]: data || []
      }));
    } catch (error) {
      console.error('取得批註失敗', error);
    }
  };

  const handleDownloadFeaturedFile = async (submissionId, fileName) => {
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
    }
  };

  if (loading) return <div className="page-container flex items-center justify-center"><span className="font-body text-gray-600">載入中...</span></div>;
  if (!course) return <div className="page-container flex items-center justify-center"><span className="font-body text-gray-600">課程不存在</span></div>;

  return (
    <div className="page-container min-h-screen">
      {/* 導航 */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="font-heading font-semibold text-primary hover:text-primary-dark transition text-sm sm:text-base shrink-0"
          >
            ← 返回
          </button>
          <div className="text-center min-w-0 flex-1">
            <h1 className="font-heading text-lg sm:text-2xl font-bold text-primary truncate">中華益師益友協會</h1>
            <p className="font-body text-xs sm:text-sm text-gray-500">伴飛計畫 2026</p>
          </div>
          <div className="w-12 sm:w-[100px] shrink-0" aria-hidden></div>
        </div>
      </nav>

      {/* 頁面標題 */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-gray-200 py-6 sm:py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <h1 className="font-heading text-2xl sm:text-4xl font-bold text-gray-800 break-words">{course.course.title}</h1>
          <p className="font-body text-gray-600 mt-3">{course.course.description}</p>
        </div>
      </div>

      {/* 分頁標籤 */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 flex gap-1 sm:gap-2 min-w-max sm:min-w-0">
          {['materials', 'assignments', 'featured', 'comments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 sm:py-4 px-3 sm:px-4 font-heading font-semibold text-xs sm:text-sm transition shrink-0 whitespace-nowrap ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary bg-primary-light'
                  : 'border-b-2 border-transparent text-gray-700 hover:text-primary'
              }`}
            >
              {tab === 'materials' && '教材'}
              {tab === 'assignments' && '作業'}
              {tab === 'featured' && '優秀作品'}
              {tab === 'comments' && '討論'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:py-12 px-3 sm:px-4">
        {activeTab === 'materials' && (
          <div>
            <h2 className="font-heading text-xl sm:text-3xl font-bold mb-6 sm:mb-8 text-gray-800">課程教材</h2>
            {course.materials.length === 0 ? (
              <div className="card text-center py-12">
                <p className="font-body text-gray-600">還沒有教材</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {course.materials
                  .filter((m) => m.visible)
                  .map((material) => (
                    <div key={material.id} className="card">
                      <h3 className="font-heading text-lg font-bold text-gray-800 mb-2">{material.title}</h3>
                      {material.description && (
                        <p className="font-body text-sm text-gray-700 mb-4">{material.description}</p>
                      )}
                      
                      {/* YouTube 內嵌 */}
                      {material.link_url && material.link_type === 'video' && getYouTubeVideoId(material.link_url) && (
                        <div className="mb-4 rounded-md overflow-hidden" style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${getYouTubeVideoId(material.link_url)}`}
                            title={material.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                          ></iframe>
                        </div>
                      )}
                      
                      <div className="flex gap-3 flex-wrap mt-4">
                        {material.file_url && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetchWithAuth(`/api/materials/${material.id}/download`);
                                if (!response.ok) {
                                  const err = await response.json().catch(() => ({}));
                                  alert(err.error || '檔案不存在，請重新上傳教材');
                                  return;
                                }
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = material.file_name || material.title;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                              } catch (error) {
                                console.error('下載失敗', error);
                                alert('下載失敗，請重試');
                              }
                            }}
                            className="font-heading font-semibold px-4 py-2 rounded-md border border-primary text-primary hover:bg-primary-light transition"
                          >
                            下載檔案
                          </button>
                        )}
                        {material.link_url && (
                          <>
                            {material.link_type === 'video' && !getYouTubeVideoId(material.link_url) && (
                              <a
                                href={material.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-heading font-semibold px-4 py-2 rounded-md border border-primary text-primary hover:bg-primary-light transition"
                              >
                                開啟影片
                              </a>
                            )}
                            {material.link_type === 'cloud' && (
                              <a
                                href={material.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-heading font-semibold px-4 py-2 rounded-md border border-primary text-primary hover:bg-primary-light transition"
                              >
                                開啟雲端資料
                              </a>
                            )}
                            {material.link_type === 'webpage' && (
                              <a
                                href={material.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-heading font-semibold px-4 py-2 rounded-md border border-primary text-primary hover:bg-primary-light transition"
                              >
                                開啟網頁
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div>
            <h2 className="font-heading text-xl sm:text-3xl font-bold mb-6 sm:mb-8 text-gray-800">作業</h2>
            {course.assignments.length === 0 ? (
              <div className="card text-center py-12">
                <p className="font-body text-gray-600">還沒有作業</p>
              </div>
            ) : designatedAssignments.size === 0 ? (
              <div className="card text-center py-12">
                <p className="font-body text-gray-600">目前沒有分配給你的作業</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {course.assignments
                  .filter(assignment => designatedAssignments.has(assignment.id))
                  .map((assignment) => (
                  <div key={assignment.id} className="card">
                    <h3 className="font-heading text-lg font-bold text-gray-800 mb-2">{assignment.title}</h3>
                    <p className="font-body text-xs text-gray-500 mb-2">
                      📋 {assignment.assignment_type === 'form' ? '填空題作答' : '檔案上傳'}
                    </p>
                    <p className="font-body text-gray-700 mb-3">{assignment.description}</p>
                    <p className="font-body text-xs text-gray-500 mb-4">
                      建立於 {formatTaipeiDate(assignment.created_at)} • 永久開放提交
                    </p>
                    <button
                      onClick={() => navigate(`/assignments/${assignment.id}/submit`)}
                      className="font-heading font-semibold px-6 py-2 rounded-md border-2 border-primary text-primary hover:bg-primary-light transition"
                    >
                      {assignment.assignment_type === 'form' ? '📝 前往作答' : '📤 提交作業'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'featured' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">優秀作品展示</h2>
            
            {featuredSubmissions.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow text-center">
                <p className="text-gray-600 text-lg">暫無優秀作品</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {featuredSubmissions.map((submission) => (
                  <div key={submission.id} className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden">
                    <div className="p-6">
                      {/* 作品信息頭部 */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">
                            {submission.assignments?.title}
                          </h3>
                          <p className="text-gray-600 mt-1 text-sm">
                            {submission.assignments?.description}
                          </p>
                        </div>
                        <p className="text-xs text-yellow-600 font-semibold">
                          優秀作品
                        </p>
                      </div>

                      {/* 學生信息 */}
                      <div className="bg-gray-50 p-4 rounded mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-600">學生</p>
                            <p className="font-semibold text-gray-800">
                              {submission.users?.display_name || submission.users?.email}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">版本</p>
                            <p className="font-semibold text-gray-800">
                              版本 {submission.version_number}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">提交於 {formatTaipeiDateTime(submission.submitted_at)}</p>

                        {/* 作品內容 */}
                        {submission.assignments?.assignment_type === 'form' && submission.resolved_answers ? (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-semibold text-gray-700 mb-2 text-sm">作答內容</h4>
                            <div className="space-y-2">
                              {submission.resolved_answers.map((qa, idx) => (
                                <div key={idx} className="bg-white p-2 rounded text-sm">
                                  <p className="font-semibold text-gray-700">{qa.title}</p>
                                  <p className="text-gray-600 mt-1">{qa.answer || '(未作答)'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : submission.assignments?.assignment_type === 'upload' ? (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                              onClick={() => handleDownloadFeaturedFile(submission.id, submission.file_name)}
                              className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                            >
                              📥 下載檔案
                            </button>
                            <p className="text-xs text-gray-600 mt-2">{submission.file_name}</p>
                          </div>
                        ) : null}
                      </div>

                      {/* 查看批註按鈕 */}
                      <button
                        onClick={() => handleViewFeaturedNotes(submission.id)}
                        className={`text-sm px-3 py-1 rounded font-semibold transition ${
                          selectedFeaturedNotes[submission.id]
                            ? 'bg-yellow-500 text-white'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        }`}
                      >
                        {selectedFeaturedNotes[submission.id] ? '✓ 展開批註' : '查看教師批註'}
                      </button>

                      {/* 批註展示 */}
                      {selectedFeaturedNotes[submission.id] && selectedFeaturedNotes[submission.id].length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="font-semibold text-gray-700 mb-2 text-sm">教師觀摩指導</h4>
                          <div className="space-y-2">
                            {selectedFeaturedNotes[submission.id].map((note) => (
                              <div key={note.id} className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm">
                                <p className="font-semibold text-gray-700">{note.users?.display_name}</p>
                                <p className="text-gray-600 mt-1 whitespace-pre-wrap">{note.content}</p>
                                <p className="text-xs text-gray-500 mt-1">{formatTaipeiDateTime(note.created_at)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">課程討論</h2>
            
            {/* 評論輸入表單 */}
            <form onSubmit={handleCommentSubmit} className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
              {replyingTo && (
                <div className="bg-blue-50 p-3 rounded mb-4 flex justify-between items-center">
                  <p className="text-sm text-blue-700">
                    回覆給 <strong>{course.comments.find(c => c.id === replyingTo)?.users?.full_name}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    ✕ 取消回覆
                  </button>
                </div>
              )}
              <textarea
                value={replyingTo ? replyText : newComment}
                onChange={(e) => replyingTo ? setReplyText(e.target.value) : setNewComment(e.target.value)}
                placeholder={replyingTo ? '輸入你的回覆...' : '分享你的想法...\n支援 Markdown 連結：[文字](url) 或直接貼上 URL'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows="4"
                required
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                {replyingTo ? '發送回覆' : '發表留言'}
              </button>
            </form>

            {/* 評論列表 */}
            <div className="space-y-4">
              {course.comments.length === 0 ? (
                <p className="text-gray-600">還沒有留言</p>
              ) : (
                course.comments
                  .filter(c => !c.parent_comment_id) // 只顯示頂級評論
                  .map((comment) => (
                    <div key={comment.id}>
                      {/* 頂級評論 */}
                      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                        <div className="flex justify-between items-start mb-2">
                          <strong className="text-gray-800">{comment.users?.full_name || '匿名用戶'}</strong>
                          <span className="text-sm text-gray-500">
                            {formatTaipeiDateTime(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap mb-4">
                          {renderLinksAsReact(comment.content).map((part, idx) =>
                            typeof part === 'string' ? (
                              <span key={idx}>{part}</span>
                            ) : (
                              <a
                                key={part.key}
                                href={part.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 underline"
                              >
                                {part.text}
                              </a>
                            )
                          )}
                        </p>
                        <button
                          onClick={() => setReplyingTo(comment.id)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          💬 回覆
                        </button>
                      </div>

                      {/* 回覆評論 */}
                      {course.comments
                        .filter(c => c.parent_comment_id === comment.id)
                        .map((reply) => (
                          <div key={reply.id} className="ml-4 sm:ml-8 mt-3 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-start mb-2">
                              <strong className="text-gray-800">{reply.users?.full_name || '匿名用戶'}</strong>
                              <span className="text-sm text-gray-500">
                                {formatTaipeiDateTime(reply.created_at)}
                              </span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap mb-3">
                              {renderLinksAsReact(reply.content).map((part, idx) =>
                                typeof part === 'string' ? (
                                  <span key={idx}>{part}</span>
                                ) : (
                                  <a
                                    key={part.key}
                                    href={part.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 underline"
                                  >
                                    {part.text}
                                  </a>
                                )
                              )}
                            </p>
                          </div>
                        ))}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
