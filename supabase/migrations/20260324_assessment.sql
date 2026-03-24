-- ============================================================
-- 課前/課後評量模組 Migration
-- 在 Supabase SQL Editor 中執行
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assessment_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'pre',  -- 'pre' | 'post'
  title text NOT NULL DEFAULT '',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_from text DEFAULT '',     -- 生成來源（簡報摘要）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_sets_project_type
  ON public.assessment_sets(project_id, type);

-- RLS：講師存取自己專案的評量，學員可讀取
ALTER TABLE public.assessment_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access own assessments" ON public.assessment_sets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = assessment_sets.project_id AND projects.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = assessment_sets.project_id AND projects.owner_id = auth.uid())
  );

CREATE POLICY "Admin access all assessments" ON public.assessment_sets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Anon read assessments" ON public.assessment_sets
  FOR SELECT TO anon
  USING (true);

-- updated_at trigger（使用已存在的 update_updated_at function）
CREATE TRIGGER assessment_sets_update_timestamp
  BEFORE UPDATE ON public.assessment_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$ BEGIN RAISE NOTICE '✅ 課前/課後評量 migration 完成'; END $$;
