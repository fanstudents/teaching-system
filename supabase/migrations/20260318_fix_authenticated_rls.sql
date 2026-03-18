-- ============================================================
-- 修補 RLS：讓 authenticated 角色也能存取原本只對 anon 開放的表
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
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Allow authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- project_files
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_files' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated full access" ON public.project_files';
    EXECUTE 'CREATE POLICY "Allow authenticated full access" ON public.project_files FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- news_articles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'news_articles' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated full access" ON public.news_articles';
    EXECUTE 'CREATE POLICY "Allow authenticated full access" ON public.news_articles FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '✅ authenticated RLS 修補完成'; END $$;
