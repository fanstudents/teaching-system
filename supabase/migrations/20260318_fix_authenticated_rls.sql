-- ============================================================
-- 修補 RLS：讓 authenticated 角色也能存取原本只對 anon 開放的表
-- 問題：getHeaders() 改用 authenticated JWT 後，
--       只有 anon policy 的表對 authenticated 使用者全部被擋
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'organizations','students','submissions','purchases',
      'affiliates','checklist_items','checklist_progress',
      'email_drafts','exam_responses','instructors','poll_votes',
      'satisfaction_responses','session_assignments','survey_questions',
      'survey_responses','system_prompts','sessions'
    ])
  LOOP
    -- 新增 authenticated 全存取（與 anon 同等權限）
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "Allow authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- projects 和 project_sessions 已在前一個 migration 中設定好 authenticated 策略
-- 不需要額外處理

-- project_files 也需要（課綱附件上傳）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_files' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY IF NOT EXISTS "Allow authenticated full access" ON public.project_files FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- news_articles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'news_articles' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY IF NOT EXISTS "Allow authenticated full access" ON public.news_articles FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '✅ authenticated RLS 修補完成'; END $$;
