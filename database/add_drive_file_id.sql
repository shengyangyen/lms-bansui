-- Google Drive 整合：新增 drive_file_id 欄位
-- 當有值時，從 Drive 下載；否則使用既有 file_url（本機路徑）

ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(100);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(100);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(100);
