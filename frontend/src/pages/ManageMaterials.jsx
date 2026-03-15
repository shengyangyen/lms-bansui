import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fetchWithAuth } from '../api';
import { formatTaipeiDateTime } from '../utils/datetime';

// 提取 YouTube Video ID
const getYouTubeVideoId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function ManageMaterials() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [materialType, setMaterialType] = useState('file'); // 'file' or 'link'
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkType, setLinkType] = useState('webpage'); // 'video', 'cloud', 'webpage'
  const [visibleFrom, setVisibleFrom] = useState('');
  const [visibleUntil, setVisibleUntil] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [editVisibleFrom, setEditVisibleFrom] = useState('');
  const [editVisibleUntil, setEditVisibleUntil] = useState('');

  useEffect(() => {
    fetchCourseAndMaterials();
  }, [courseId]);

  const fetchCourseAndMaterials = async () => {
    try {
      const { data } = await api.get(`/courses/${courseId}`);
      setCourse(data.course);
      setMaterials(data.materials);
    } catch (error) {
      console.error('取得課程失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!title) {
      alert('請輸入標題');
      return;
    }

    if (materialType === 'file' && !file) {
      alert('請選擇檔案');
      return;
    }

    if (materialType === 'link' && !linkUrl) {
      alert('請輸入連結網址');
      return;
    }

    setUploading(true);

    try {
      let data;
      
      if (materialType === 'file') {
        // 上傳檔案
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('visibleFrom', visibleFrom);
        formData.append('visibleUntil', visibleUntil);

        const res = await api.post(`/courses/${courseId}/materials`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        data = res.data;
      } else {
        // 添加連結
        const res = await api.post(`/courses/${courseId}/materials`, {
          title,
          description,
          linkUrl,
          linkType,
          visibleFrom: visibleFrom || null,
          visibleUntil: visibleUntil || null
        });
        data = res.data;
      }
      
      // 自動發佈
      const publishedData = await api.patch(`/materials/${data.id}/visibility`, {
        visible: true
      });
      
      setMaterials([...materials, publishedData]);
      setMaterialType('file');
      setFile(null);
      setTitle('');
      setDescription('');
      setLinkUrl('');
      setLinkType('webpage');
      setVisibleFrom('');
      setVisibleUntil('');
      alert('教材新增成功！');
    } catch (error) {
      console.error('新增失敗', error);
      alert('新增失敗：' + error.response?.data?.error);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleVisibility = async (materialId, currentVisible) => {
    try {
      const { data } = await api.patch(`/materials/${materialId}/visibility`, {
        visible: !currentVisible,
        visibleFrom: visibleFrom,
        visibleUntil: visibleUntil
      });
      setMaterials(materials.map(m => m.id === materialId ? data : m));
    } catch (error) {
      console.error('更新失敗', error);
      alert('更新失敗');
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!confirm('確定要刪除此教材嗎？')) return;
    
    try {
      await api.delete(`/materials/${materialId}`);
      setMaterials(materials.filter(m => m.id !== materialId));
      alert('刪除成功！');
    } catch (error) {
      console.error('刪除失敗', error);
      alert('刪除失敗');
    }
  };

  const handleEditTime = (material) => {
    setEditingMaterialId(material.id);
    if (material.visible_from) {
      const date = new Date(material.visible_from);
      const iso = date.toISOString().slice(0, 16);
      setEditVisibleFrom(iso);
    } else {
      setEditVisibleFrom('');
    }
    if (material.visible_until) {
      const date = new Date(material.visible_until);
      const iso = date.toISOString().slice(0, 16);
      setEditVisibleUntil(iso);
    } else {
      setEditVisibleUntil('');
    }
  };

  const handleSaveEditTime = async () => {
    try {
      const { data } = await api.patch(`/materials/${editingMaterialId}/visibility`, {
        visible: true,
        visibleFrom: editVisibleFrom ? new Date(editVisibleFrom).toISOString() : null,
        visibleUntil: editVisibleUntil ? new Date(editVisibleUntil).toISOString() : null
      });
      setMaterials(materials.map(m => m.id === editingMaterialId ? data : m));
      setEditingMaterialId(null);
      alert('時間調整成功！');
    } catch (error) {
      console.error('調整失敗', error);
      alert('調整失敗：' + error.response?.data?.error);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  if (!course) return <div className="min-h-screen flex items-center justify-center">課程不存在</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              ← 返回管理面板
            </button>
            <button
              onClick={() => navigate(`/admin/assignments/${courseId}`)}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded font-semibold"
            >
              作業管理
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{course.title}</h1>
        <p className="text-gray-600 mb-8">管理課程教材</p>

        {/* 上傳表單 */}
        <div className="bg-white p-8 rounded-lg shadow mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">新增教材</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="flex gap-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="file"
                  checked={materialType === 'file'}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="font-semibold text-gray-700">📁 上傳檔案</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="link"
                  checked={materialType === 'link'}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="font-semibold text-gray-700">🔗 添加連結</span>
              </label>
            </div>

            <input
              type="text"
              placeholder="教材標題"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />

            <textarea
              placeholder="教材說明/描述（選填）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
            
            {materialType === 'file' ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="cursor-pointer block"
                >
                  <div className="text-gray-600">
                    {file ? (
                      <div>
                        <p className="font-semibold text-blue-600">{file.name}</p>
                        <p className="text-sm text-gray-500">點擊更換檔案</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold">點擊選擇檔案</p>
                        <p className="text-sm text-gray-500">或將檔案拖拽到此</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  連結網址
                </label>
                <input
                  type="url"
                  placeholder="例如：https://youtube.com/watch?v=... 或 https://drive.google.com/file/..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  required={materialType === 'link'}
                />
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  連結類型
                </label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="webpage">網頁</option>
                  <option value="video">影片</option>
                  <option value="cloud">雲端資料</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  可見開始時間（選填）
                </label>
                <input
                  type="datetime-local"
                  value={visibleFrom}
                  onChange={(e) => setVisibleFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  可見結束時間（選填）
                </label>
                <input
                  type="datetime-local"
                  value={visibleUntil}
                  onChange={(e) => setVisibleUntil(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {uploading ? '上傳中...' : '上傳教材'}
            </button>
          </form>
        </div>

        {/* 編輯時間模態框 */}
        {editingMaterialId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-sm w-full mx-4">
              <h3 className="text-2xl font-bold mb-4 text-gray-800">編輯發佈時間</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    可見開始時間（選填）
                  </label>
                  <input
                    type="datetime-local"
                    value={editVisibleFrom}
                    onChange={(e) => setEditVisibleFrom(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    可見結束時間（選填）
                  </label>
                  <input
                    type="datetime-local"
                    value={editVisibleUntil}
                    onChange={(e) => setEditVisibleUntil(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleSaveEditTime}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingMaterialId(null)}
                    className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 教材列表 */}
        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">課程教材列表</h2>
          
          {materials.length === 0 ? (
            <p className="text-gray-600">還沒有教材</p>
          ) : (
            <div className="space-y-4">
              {materials.map((material) => (
                <div key={material.id} className="border border-gray-200 p-6 rounded-lg hover:shadow-lg transition">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800">{material.title}</h3>
                      {material.description && (
                        <p className="text-sm text-gray-700 mt-2">{material.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        上傳時間：{formatTaipeiDateTime(material.upload_date)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {material.visible && (
                        <span className="bg-green-500 text-white px-4 py-2 rounded font-semibold">
                          已發佈
                        </span>
                      )}
                      <button
                        onClick={() => handleEditTime(material)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold transition text-sm"
                      >
                        編輯時間
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold transition"
                      >
                        刪除
                      </button>
                    </div>
                  </div>

                  {material.visible_from && (
                    <p className="text-sm text-gray-600 mb-2">
                      發佈時間：{formatTaipeiDateTime(material.visible_from)} 至 {
                        material.visible_until ? formatTaipeiDateTime(material.visible_until) : '無截止日期'
                      }
                    </p>
                  )}

                  {/* YouTube 內嵌 */}
                  {material.link_url && material.link_type === 'video' && getYouTubeVideoId(material.link_url) && (
                    <div className="mb-4" style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${getYouTubeVideoId(material.link_url)}`}
                        title={material.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '0.5rem' }}
                      ></iframe>
                    </div>
                  )}

                  <div className="flex gap-3 flex-wrap">
                    {(material.file_url || material.drive_file_id) && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetchWithAuth(`/api/materials/${material.id}/download`);
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              alert(err.error || '檔案不存在，請重新上傳教材');
                              return;
                            }
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = material.file_name || material.title;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch (e) {
                            alert('下載失敗');
                          }
                        }}
                        className="text-blue-600 hover:text-blue-700 font-semibold"
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
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                          >
                            開啟影片
                          </a>
                        )}
                        {material.link_type === 'cloud' && (
                          <a
                            href={material.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                          >
                            開啟雲端資料
                          </a>
                        )}
                        {material.link_type === 'webpage' && (
                          <a
                            href={material.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-semibold"
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
      </div>
    </div>
  );
}
