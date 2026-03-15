# LMS（學習管理系統）- 設置說明

## 📁 資料夾結構說明

```
LMS/
├── backend/           # Node.js後端
│   ├── package.json
│   ├── .env
│   └── src/
│       └── index.js
├── frontend/          # React前端
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── store.js
│       ├── api.js
│       ├── index.css
│       └── pages/
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx
│           ├── CourseDetail.jsx
│           └── AdminPanel.jsx
├── database/
│   └── schema.sql     # 資料庫結構
├── public/
│   └── uploads/       # 檔案上傳目錄
└── docs/
    └── README.md
```

## 🔧 技術棧

- **前端**：React + Vite + Tailwind CSS
- **後端**：Node.js + Express
- **資料庫**：Supabase (PostgreSQL)
- **認證**：JWT + bcryptjs
- **檔案上傳**：Multer

## 📋 設置步驟

### 1️⃣ 設置Supabase資料庫（必須先做）

1. 打開瀏覽器，進入 https://supabase.com
2. 點擊 **"Sign up"** 使用 GitHub 或 Google 登入
3. 建立新 Project：
   - 輸入專案名稱：`lms`
   - 選擇地區：`Singapore` （最靠近台灣）
   - 設置密碼
   - 點擊 **"Create new project"** 等待 1-2 分鐘

4. 專案建立完成後，在左側邊欄找到 **"SQL Editor"** 
5. 複製 `database/schema.sql` 中的所有 SQL 程式碼
6. 在 Supabase SQL Editor 中貼上並執行（點擊執行按鈕）
7. 如果看到綠色 ✓ 表示成功

8. 取得連線資訊：
   - 在左側選擇 **"Settings" → "API"**
   - 複製：
     - **Project URL** → `SUPABASE_URL`
     - **anon public** key → `SUPABASE_KEY`

9. 編輯 `backend/.env`：
```
SUPABASE_URL=你複製的Project_URL
SUPABASE_KEY=你複製的anon_key
JWT_SECRET=my_super_secret_key_12345_change_this_later
PORT=3001
```

### 2️⃣ 安裝後端依賴

打開終端機（Terminal），執行以下命令：

```bash
# 進入後端資料夾
cd backend

# 安裝依賴
npm install

# 啟動開發伺服器（在 http://localhost:3001）
npm run dev
```

如果看到這樣的訊息表示成功：
```
✓ 後端運行於 http://localhost:3001
```

### 3️⃣ 安裝前端依賴

**打開新的終端機視窗**，執行：

```bash
# 進入前端資料夾
cd frontend

# 安裝依賴
npm install

# 啟動開發伺服器（在 http://localhost:3000）
npm run dev
```

### 4️⃣ 測試系統

1. 打開瀏覽器進入：http://localhost:3000
2. 點擊 **"立即註冊"**
3. 填寫：
   - 姓名：`測試用戶`
   - 電子郵件：`test@example.com`
   - 密碼：`123456`
4. 點擊 **"註冊"** → 跳轉到登入頁面
5. 使用剛才的帳號密碼登入
6. 成功！你應該看到空的課程列表

## 🎯 常見問題排查

### 後端無法啟動
- 檢查 `.env` 是否正確設置 `SUPABASE_URL` 和 `SUPABASE_KEY`
- 檢查 `npm install` 是否完成
- 確認 3001 port 沒有被其他程式占用

### 前端無法連接後端
- 確認後端已在 http://localhost:3001 運行
- 檢查防火牆設置

### Supabase 連接失敗
- 檢查 `.env` 中的 URL 和 KEY 是否複製正確（不要有多餘空白）
- 登入 Supabase 確認專案狀態是否正常

## 🚀 下一步：管理員帳號設置

為了測試管理員功能，需要手動更改用戶角色。登入 Supabase → 進入 `users` 表格 → 編輯你的帳號，將 `role` 改為 `instructor` 或 `admin`。

然後重新整理頁面就能看到 **"管理面板"** 按鈕。

---

**有任何問題隨時問我！**
