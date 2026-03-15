-- ========================================
-- 根治時區問題：將 timestamp 改為 timestamptz
-- 說明：
-- 1) 只會轉換目前是 "timestamp without time zone" 的欄位
-- 2) 既有資料以 UTC 解讀並轉成 timestamptz（避免 +8/-8 錯位）
-- ========================================

DO $$
BEGIN
  -- users
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE ''UTC''';
  END IF;

  -- courses
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE courses ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE ''UTC''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses'
      AND column_name = 'updated_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE courses ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE ''UTC''';
  END IF;

  -- course_materials
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_materials'
      AND column_name = 'upload_date'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE course_materials ALTER COLUMN upload_date TYPE TIMESTAMPTZ USING upload_date AT TIME ZONE ''UTC''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_materials'
      AND column_name = 'visible_from'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE course_materials ALTER COLUMN visible_from TYPE TIMESTAMPTZ USING visible_from AT TIME ZONE ''UTC''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_materials'
      AND column_name = 'visible_until'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE course_materials ALTER COLUMN visible_until TYPE TIMESTAMPTZ USING visible_until AT TIME ZONE ''UTC''';
  END IF;

  -- assignments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE assignments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE ''UTC''';
  END IF;

  -- submissions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions'
      AND column_name = 'submitted_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE submissions ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE ''UTC''';
  END IF;

  -- feedback
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feedback'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE feedback ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE ''UTC''';
  END IF;

  -- comments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE comments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE ''UTC''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments'
      AND column_name = 'updated_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE comments ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE ''UTC''';
  END IF;

  -- course_enrollments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_enrollments'
      AND column_name = 'enrolled_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE course_enrollments ALTER COLUMN enrolled_at TYPE TIMESTAMPTZ USING enrolled_at AT TIME ZONE ''UTC''';
  END IF;

  -- assignment_questions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignment_questions'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE assignment_questions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE ''UTC''';
  END IF;

  -- form_submissions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_submissions'
      AND column_name = 'submitted_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE form_submissions ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE ''UTC''';
  END IF;

  -- individual_assignments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'individual_assignments'
      AND column_name = 'assigned_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE individual_assignments ALTER COLUMN assigned_at TYPE TIMESTAMPTZ USING assigned_at AT TIME ZONE ''UTC''';
  END IF;

  -- showcase_submissions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'showcase_submissions'
      AND column_name = 'showcased_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE showcase_submissions ALTER COLUMN showcased_at TYPE TIMESTAMPTZ USING showcased_at AT TIME ZONE ''UTC''';
  END IF;
END $$;

-- 驗證目前欄位型別（可執行查看）
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN (
  'users', 'courses', 'course_materials', 'assignments', 'submissions',
  'feedback', 'comments', 'course_enrollments', 'assignment_questions',
  'form_submissions', 'individual_assignments', 'showcase_submissions'
)
AND column_name IN (
  'created_at', 'updated_at', 'upload_date', 'visible_from', 'visible_until',
  'submitted_at', 'enrolled_at', 'assigned_at', 'showcased_at'
)
ORDER BY table_name, column_name;
