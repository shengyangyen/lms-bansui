# API 權限檢查報告

## 檢查結果摘要

| 狀態 | 數量 |
|------|------|
| ✅ 已有正確權限檢查 | 多數 |
| ⚠️ 需修復 | 8 項 |

---

## ⚠️ 需修復項目

### 1. GET /api/courses — 無需登入
- **現狀**：任何人可取得所有課程列表
- **風險**：低（課程名稱非高度敏感）
- **建議**：若首頁需顯示課程，可維持；否則改為需登入

### 2. GET /api/courses/:courseId — 無需登入
- **現狀**：任何人可取得課程詳情（教材、作業、留言）
- **風險**：高
- **建議**：改為需登入，且需為該課程學員或教師

### 3. GET /api/materials/:materialId/download — 無需登入
- **現狀**：任何人可下載任何教材檔案（猜 materialId 即可）
- **風險**：高
- **建議**：需登入，且需為該課程學員或教師

### 4. DELETE /api/materials/:materialId — 無權限檢查
- **現狀**：任何登入用戶可刪除任何教材
- **風險**：高
- **建議**：需為該課程教師或 admin

### 5. PATCH /api/materials/:materialId/visibility — 無權限檢查
- **現狀**：任何登入用戶可修改任何教材可見性
- **風險**：高
- **建議**：需為該課程教師或 admin

### 6. GET /api/submissions/:submissionId/download — 無需登入
- **現狀**：任何人可下載任何學員提交的作業檔案
- **風險**：高
- **建議**：需登入，且為該提交的學員本人或該課程教師

### 7. GET /api/feedback/:feedbackId/download — 無需登入
- **現狀**：任何人可下載任何批改回饋檔案
- **風險**：高
- **建議**：需登入，且為該 feedback 對應的學員或教師

### 8. POST /api/courses/:courseId/comments — 無選課檢查
- **現狀**：任何登入用戶可對任何課程留言
- **風險**：中
- **建議**：需為該課程學員或教師

---

## ✅ 已有正確檢查的 API（範例）

- 所有 `/api/admin/*`：檢查 admin 或 instructor
- 所有 `/api/users/me/*`：用 req.user.userId 限定本人
- 作業提交、批改、統計：檢查教師身份或學員本人
- 課程 enroll、教材上傳：檢查教師身份
