-- 使用者通知偏好（勾選 = 要收信，不勾選 = 不收）
-- graded: 作業批改完成, material: 教材上線, assignment: 作業上線, enrolled: 加入課程
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"graded":true,"material":true,"assignment":true,"enrolled":true}'::jsonb;
