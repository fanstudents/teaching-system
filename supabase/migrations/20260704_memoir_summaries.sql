-- ============================================================
-- 學員個人課後回憶錄：memoir_summaries
-- 快取每位學員的 AI 生成回憶錄開篇敘事，避免每次重整頁面
-- 都重新呼叫 AI（節省成本、避免內容不一致）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.memoir_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  student_email text NOT NULL,
  student_name text NOT NULL DEFAULT '',
  course_title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_memoir_summaries_identity
  ON public.memoir_summaries(session_id, student_email);

ALTER TABLE public.memoir_summaries ENABLE ROW LEVEL SECURITY;

-- anon + authenticated 兩個角色一次寫齊（collector 模組上次漏補 authenticated
-- 導致已登入學員被 RLS 擋下，這次直接一併處理）
DROP POLICY IF EXISTS "Allow anon full access" ON public.memoir_summaries;
CREATE POLICY "Allow anon full access" ON public.memoir_summaries
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access" ON public.memoir_summaries;
CREATE POLICY "Allow authenticated full access" ON public.memoir_summaries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '✅ memoir_summaries 資料表建立完成'; END $$;
