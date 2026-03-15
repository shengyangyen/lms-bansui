-- 新增欄位到 users 表以支援帳號審核和角色管理

ALTER TABLE users
ADD COLUMN display_name VARCHAR(255),
ADD COLUMN real_name VARCHAR(255),
ADD COLUMN status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN email_verified BOOLEAN DEFAULT false,
ADD COLUMN user_role VARCHAR(50) DEFAULT 'student',
ADD COLUMN created_at TIMESTAMP DEFAULT NOW();

-- 注：執行前請確保資料庫已備份
-- 在 Supabase 的 SQL Editor 中執行此腳本
