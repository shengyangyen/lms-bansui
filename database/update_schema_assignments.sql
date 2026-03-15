-- ========================================
-- 作業系統 - 資料庫結構更新
-- ========================================

-- 1. 修改 course_materials 表 - 加入教材說明與外部連結支援
ALTER TABLE course_materials 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS link_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS link_type VARCHAR(50);

-- 2. 修改 course_materials 表 - 加入前置解鎖欄位
ALTER TABLE course_materials 
ADD COLUMN IF NOT EXISTS required_assignment_id UUID REFERENCES assignments(id),
ADD COLUMN IF NOT EXISTS required_grade VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;

-- 3. 修改 assignments 表
-- 移除 deadline（無截止日期政策），加入 created_by
ALTER TABLE assignments 
DROP COLUMN IF EXISTS deadline,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- 4. 修改 submissions 表 - 版本管理
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS version_number INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true;

-- 5. 修改 feedback 表 - 評分等級與多種回饋方式
ALTER TABLE feedback 
ADD COLUMN IF NOT EXISTS grade VARCHAR(50),
ADD COLUMN IF NOT EXISTS feedback_file_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS feedback_image_url VARCHAR(500);

-- 如果 rating 欄位存在，才刪除（避免報錯）
DO $$
BEGIN
  ALTER TABLE feedback DROP COLUMN IF EXISTS rating;
EXCEPTION WHEN undefined_column THEN
  NULL;
END $$;

-- 6. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_is_latest ON submissions(is_latest);
CREATE INDEX IF NOT EXISTS idx_feedback_submission_id ON feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
