-- ========================================
-- 新功能支持：填空題、個別作業、統計、優良作品展示
-- ========================================

-- 1. 作業類型支持：檔案上傳 vs 填空題
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50) DEFAULT 'upload'; -- 'upload' or 'form'

-- 2. 填空題表
CREATE TABLE IF NOT EXISTS assignment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  question_type VARCHAR(50) DEFAULT 'text', -- 'text', 'textarea', 'multiple_choice'
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(assignment_id, question_number)
);

-- 3. 學生填空題答案
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id),
  answers JSONB, -- 存儲答案 {question_id: answer_value}
  version_number INT DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(assignment_id, student_id, version_number)
);

-- 4. 個別作業分配
CREATE TABLE IF NOT EXISTS individual_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- 5. 優良作品展示
CREATE TABLE IF NOT EXISTS showcase_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id),
  form_submission_id UUID REFERENCES form_submissions(id),
  assignment_id UUID REFERENCES assignments(id),
  instructor_comment TEXT,
  showcased_at TIMESTAMP DEFAULT NOW()
);

-- 6. 作業統計視圖（便於查詢）
CREATE OR REPLACE VIEW assignment_statistics AS
SELECT 
  a.id as assignment_id,
  a.title as assignment_title,
  a.course_id,
  COUNT(DISTINCT CASE WHEN ia.id IS NULL THEN NULL ELSE u.id END) as total_students,
  COUNT(DISTINCT CASE WHEN ia.id IS NOT NULL THEN u.id ELSE NULL END) as assigned_count,
  COUNT(DISTINCT s.id) as submitted_count,
  COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN s.id ELSE NULL END) as graded_count,
  COUNT(DISTINCT CASE WHEN f.grade = '優秀' THEN s.id ELSE NULL END) as excellent_count,
  COUNT(DISTINCT CASE WHEN f.grade = '合格' THEN s.id ELSE NULL END) as pass_count,
  COUNT(DISTINCT CASE WHEN f.grade = '建議需調整' THEN s.id ELSE NULL END) as needs_revision_count
FROM assignments a
LEFT JOIN individual_assignments ia ON a.id = ia.assignment_id
LEFT JOIN users u ON (ia.student_id = u.id OR u.role = 'student')
LEFT JOIN submissions s ON a.id = s.assignment_id AND s.is_latest = true
LEFT JOIN feedback f ON s.id = f.submission_id
GROUP BY a.id, a.title, a.course_id;

-- 7. 索引優化
CREATE INDEX IF NOT EXISTS idx_individual_assignments_assignment ON individual_assignments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_individual_assignments_student ON individual_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_assignment ON form_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_student ON form_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_showcase_submissions_assignment ON showcase_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment ON assignment_questions(assignment_id);
