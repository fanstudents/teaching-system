-- 新增 show_survey 欄位到 project_sessions
ALTER TABLE public.project_sessions
ADD COLUMN IF NOT EXISTS show_survey boolean DEFAULT true;
