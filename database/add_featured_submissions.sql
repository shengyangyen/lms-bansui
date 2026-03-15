-- 優秀作品系統遷移腳本
-- 執行時間：2026-03-12

-- 1. 在 submissions 表新增優秀作品標記欄位
ALTER TABLE submissions
ADD COLUMN is_featured BOOLEAN DEFAULT false,
ADD COLUMN featured_at TIMESTAMP DEFAULT NULL;

-- 2. 建立優秀作品批註表
CREATE TABLE IF NOT EXISTS featured_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 建立索引以提升查詢效能
CREATE INDEX idx_featured_submissions_course ON submissions(course_id, is_featured DESC, featured_at DESC);
CREATE INDEX idx_featured_notes_submission ON featured_notes(submission_id);
CREATE INDEX idx_featured_notes_course ON featured_notes(course_id);

-- 4. 添加批註 - 記錄修改時間的觸發器
CREATE OR REPLACE FUNCTION update_featured_notes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_featured_notes_updated
BEFORE UPDATE ON featured_notes
FOR EACH ROW
EXECUTE FUNCTION update_featured_notes_timestamp();
