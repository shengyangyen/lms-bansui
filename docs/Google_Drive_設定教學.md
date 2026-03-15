# Google Drive 整合設定教學（一步一步）

這份文件帶你完成 LMS 的 Google Drive 整合，讓教材、作業、批改檔案存到你的 Drive，不會因 Render 重啟而消失。

---

## 步驟 1：建立 Google Cloud 專案

1. 打開瀏覽器，前往 [https://console.cloud.google.com](https://console.cloud.google.com)
2. 用你的 Google 帳號登入
3. 點左上角專案名稱旁的下拉選單 → **新增專案**
4. **專案名稱**：輸入 `LMS-Bansui`（或任意名稱）
5. 點 **建立**
6. 建立完成後，確認左上角已選到這個新專案

---

## 步驟 2：啟用 Google Drive API

1. 左側選單點 **API 和服務** → **已啟用的 API 和服務**
2. 點上方 **+ 啟用 API 和服務**
3. 搜尋 `Google Drive API`
4. 點進去後，點 **啟用**
5. 啟用完成會看到「已啟用 API」的畫面

---

## 步驟 3：建立 Service Account 並下載 JSON

1. 左側選單點 **API 和服務** → **憑證**
2. 點上方 **+ 建立憑證** → 選 **服務帳戶**
3. **服務帳戶名稱**：輸入 `lms-drive`（或任意名稱）
4. 點 **建立並繼續** → 角色可跳過 → 點 **完成**
5. 在憑證列表找到剛建立的服務帳戶（名稱像 `lms-drive@專案ID.iam.gserviceaccount.com`）
6. 點進去
7. 切到 **金鑰** 分頁
8. 點 **新增金鑰** → **建立新金鑰**
9. 選 **JSON** → 點 **建立**
10. 瀏覽器會下載一個 `.json` 檔，**妥善保存**，等一下會用到

---

## 步驟 4：在 Google Drive 建立資料夾並共用

1. 打開 [https://drive.google.com](https://drive.google.com)
2. 點左側 **新增** → **資料夾**
3. 資料夾名稱：`LMS 教材與作業`（或任意名稱）
4. 建立後，**右鍵點該資料夾** → **共用**
5. 在「新增使用者和群組」欄位，貼上步驟 3 下載的 JSON 檔裡面的 `client_email`
   - 用記事本打開 JSON，找到類似 `"client_email": "lms-drive@xxxxx.iam.gserviceaccount.com"` 的那串
   - 複製整串 email（含 @ 後面）
6. 權限選 **編輯者**
7. 取消勾選「通知使用者」（因為是機器帳號）
8. 點 **共用**

---

## 步驟 5：取得資料夾 ID

1. 在 Google Drive 點進剛建立的資料夾
2. 看瀏覽器網址列，格式類似：
   ```
   https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J
   ```
3. **`1a2B3c4D5e6F7g8H9i0J`** 這一段就是 **Folder ID**
4. 複製起來，等一下會用到

---

## 步驟 6：把 JSON 壓成單行

1. 用記事本或 VS Code 打開步驟 3 下載的 JSON 檔
2. 內容有多行、有換行，需要壓成**一行**
3. 方法一：用 VS Code，全選 → 刪除所有換行（把 `\n` 都刪掉）
4. 方法二：用線上工具 [https://www.textfixer.com/tools/remove-line-breaks.php](https://www.textfixer.com/tools/remove-line-breaks.php) 貼上 JSON → 取得單行結果
5. 確認結果是類似這樣（一整行、沒有換行）：
   ```json
   {"type":"service_account","project_id":"xxx",...}
   ```
6. **複製整段**，等一下要貼到 Render

---

## 步驟 7：在 Render 設定環境變數

1. 前往 [https://dashboard.render.com](https://dashboard.render.com)
2. 點進你的 `lms-backend` 服務
3. 左側點 **Environment**
4. 點 **Add Environment Variable**
5. 新增兩筆：

   | Key | Value |
   |-----|-------|
   | `GOOGLE_DRIVE_CREDENTIALS_JSON` | 步驟 6 的單行 JSON（整段貼上） |
   | `GOOGLE_DRIVE_FOLDER_ID` | 步驟 5 的資料夾 ID |

6. 點 **Save Changes**
7. Render 會自動重新部署，等 2～3 分鐘

---

## 步驟 8：在 Supabase 執行資料庫 migration

1. 前往 [https://supabase.com](https://supabase.com) → 登入 → 選你的專案
2. 左側點 **SQL Editor**
3. 點 **New query**
4. 複製貼上以下 SQL（或從專案 `database/add_drive_file_id.sql` 複製）：

```sql
-- Google Drive 整合：新增 drive_file_id 欄位
ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(100);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(100);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(100);
```

5. 點 **Run**（或按 Ctrl+Enter）
6. 看到「Success」即完成

---

## 步驟 9：驗證

1. 等 Render 部署完成（狀態顯示 Live）
2. 打開你的 LMS 網站
3. 登入後，進入任一課程
4. 上傳一筆**新教材**（PDF 或任意檔案）
5. 到 Google Drive 開啟步驟 4 的資料夾
6. 應該會看到剛上傳的檔案

若看到檔案，代表整合成功。之後新上傳的教材、作業、批改附件都會存到這個資料夾。

---

## 常見問題

**Q：Render 部署失敗？**  
A：檢查 `GOOGLE_DRIVE_CREDENTIALS_JSON` 是否為**單行**、沒有多餘引號或換行。

**Q：上傳後 Drive 沒看到檔案？**  
A：確認資料夾有共用給 Service Account 的 `client_email`，且權限為「編輯者」。

**Q：舊的教材下載失敗？**  
A：舊資料仍存在本機，Render 重啟後會消失。需重新上傳教材才會存到 Drive。
