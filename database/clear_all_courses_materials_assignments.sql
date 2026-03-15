-- 清空教材、課程、作業、批改、提交等（保留用戶）
-- 在 Supabase SQL Editor 執行，執行前請確認！無法復原！

-- 依外鍵順序刪除
DELETE FROM feedback;
DELETE FROM featured_notes;
DELETE FROM showcase_submissions;
DELETE FROM submissions;
DELETE FROM form_submissions;
DELETE FROM individual_assignments;
DELETE FROM assignment_questions;
DELETE FROM assignments;
DELETE FROM course_materials;
DELETE FROM course_enrollments;
DELETE FROM comments;
DELETE FROM courses;

-- 可選：一併清空經驗值、徽章、動態（若需完全重置）
-- DELETE FROM user_badges;
-- DELETE FROM experience_logs;
-- DELETE FROM activity_notifications;
