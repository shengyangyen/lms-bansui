-- ========================================
-- 修復作業新功能表的 RLS 阻擋
-- ========================================
-- 說明：
-- 目前後端使用的是 publishable key，若表啟用 RLS 且無 policy，
-- INSERT/UPDATE/SELECT 會被阻擋，出現:
-- "new row violates row-level security policy"
--
-- 這支先採用與你現有專案一致的做法：直接關閉這幾張表的 RLS。
-- ========================================

ALTER TABLE IF EXISTS assignment_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS individual_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS showcase_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback DISABLE ROW LEVEL SECURITY;

-- 驗證狀態
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN (
  'assignment_questions',
  'form_submissions',
  'individual_assignments',
  'showcase_submissions',
  'assignments',
  'submissions',
  'feedback'
)
ORDER BY tablename;
