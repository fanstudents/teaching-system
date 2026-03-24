-- ============================================================
-- 場次級簡報資料：讓每個場次可以有獨立的簡報內容
-- ============================================================

ALTER TABLE public.project_sessions
  ADD COLUMN IF NOT EXISTS slides_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.project_sessions.slides_data IS 
  '場次覆蓋簡報，NULL 時 fallback 到 project.slides_data';

DO $$ BEGIN RAISE NOTICE '✅ project_sessions.slides_data 欄位已新增'; END $$;
