-- 上線前清空測試資料（請在 Supabase SQL Editor 執行）
-- 執行前請確認：這會刪除所有指定資料，無法復原！

-- ============ 1. 留言區（課程討論留言）============
DELETE FROM comments;

-- ============ 2. 若需一併清空其他測試資料 ============
-- 請依序執行（因外鍵關聯），或分次執行後再執行下一段

-- 2a. 批改、精選、作業提交
-- DELETE FROM featured_notes;
-- DELETE FROM showcase_submissions;
-- DELETE FROM feedback;
-- DELETE FROM submissions;
-- DELETE FROM form_submissions;
-- DELETE FROM assignment_questions;
-- DELETE FROM assignments;

-- 2b. 教材、選課、課程
-- DELETE FROM course_materials;
-- DELETE FROM course_enrollments;
-- DELETE FROM courses;

-- 2c. 用戶（會刪除所有帳號，請謹慎！）
-- DELETE FROM user_badges;
-- DELETE FROM user_levels;
-- DELETE FROM experience_logs;
-- DELETE FROM activity_notifications;
-- DELETE FROM contact_messages;
-- DELETE FROM users;
