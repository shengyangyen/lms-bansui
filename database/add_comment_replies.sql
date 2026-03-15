-- 評論回覆系統遷移腳本
-- 執行時間：2026-03-12

-- 1. 在 comments 表新增父評論欄位（支援回覆）
ALTER TABLE comments
ADD COLUMN parent_comment_id UUID DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE;

-- 2. 建立索引優化查詢
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_course_parent ON comments(course_id, parent_comment_id);
