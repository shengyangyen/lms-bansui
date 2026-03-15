-- ========================================
-- 激勵系統 Phase A：等級與經驗值
-- ========================================

-- 1. 學員等級與經驗值（每個學員一筆，懶更新）
CREATE TABLE IF NOT EXISTS user_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_exp INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. 經驗值取得紀錄（用於：同一作業只取最高、稽核）
CREATE TABLE IF NOT EXISTS experience_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,  -- 'assignment' | 'course' | 'badge'
  source_id UUID,                     -- assignment_id / course_id / badge_id
  grade VARCHAR(50),                  -- '建議需調整'|'合格'|'優秀' (僅 assignment)
  exp_amount INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)  -- 同一來源只記一筆，更新時 UPSERT
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_user_levels_user ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_logs_user ON experience_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_logs_source ON experience_logs(source_type, source_id);

-- 4. 關閉 RLS（開發階段，之後可補策略）
ALTER TABLE user_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE experience_logs DISABLE ROW LEVEL SECURITY;
