-- ============================================================
-- 修補：survey_questions / checklist_items 的 anon 權限
-- 問題：multi-tenant migration 後只加了 authenticated，
--       但 admin-preclass.html 可能以 anon 操作（未登入時）
-- ============================================================

-- survey_questions — anon 完整權限
DROP POLICY IF EXISTS "Allow anon full access survey_questions" ON public.survey_questions;
CREATE POLICY "Allow anon full access survey_questions" ON public.survey_questions
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- checklist_items — anon 完整權限
DROP POLICY IF EXISTS "Allow anon full access checklist_items" ON public.checklist_items;
CREATE POLICY "Allow anon full access checklist_items" ON public.checklist_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '✅ survey_questions / checklist_items anon RLS 修補完成'; END $$;
