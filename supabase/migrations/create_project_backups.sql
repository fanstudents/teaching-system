-- 在 Supabase Dashboard → SQL Editor 執行此 SQL
-- 建立 project_backups 備份表

CREATE TABLE IF NOT EXISTS project_backups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slides_data JSONB NOT NULL,
    slide_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引：方便按專案查詢 + 清理舊備份
CREATE INDEX IF NOT EXISTS idx_backups_project_time
ON project_backups (project_id, created_at DESC);

-- RLS: 允許所有人讀寫（與 projects 同級權限）
ALTER TABLE project_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to backups"
ON project_backups FOR ALL
USING (true)
WITH CHECK (true);

-- 自動清理：保留每個專案最近 10 份備份
-- （可選）定期手動執行或設為 cron job
-- DELETE FROM project_backups
-- WHERE id NOT IN (
--     SELECT id FROM (
--         SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) AS rn
--         FROM project_backups
--     ) t WHERE rn <= 10
-- );
