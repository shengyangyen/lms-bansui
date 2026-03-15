-- course_materials 表加入 file_name 欄位（儲存原始檔名，供下載時 Content-Disposition 使用）
ALTER TABLE course_materials 
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
