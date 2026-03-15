-- ========================================
-- 排行榜系統
-- 執行時間：2026-03-14
-- ========================================

-- 1. 系統設定表（用於排行榜開關等）
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 排行榜預設為關閉
INSERT INTO system_settings (key, value)
VALUES ('leaderboard_visible', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. 關閉 RLS（開發階段）
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
