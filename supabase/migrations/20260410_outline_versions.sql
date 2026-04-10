-- ============================================================
-- 課綱版本管理 Migration
-- ============================================================

-- projects 表新增 outline_versions JSONB
-- 存多版本課綱，每個元素含 name, data (完整 outline), created_at
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS outline_versions jsonb DEFAULT '[]'::jsonb;

-- 備註：
-- outline_versions 結構：
-- [
--   {
--     "name": "版本一：3小時基礎班",
--     "data": { "timeline": [...], "tools": [...], "equipment": [...], "instructors": [...] },
--     "created_at": "2026-04-10T12:00:00Z"
--   }
-- ]
-- outline_data 保留為「當前作用版本」向後相容

DO $$ BEGIN RAISE NOTICE '✅ projects.outline_versions 欄位新增完成'; END $$;
