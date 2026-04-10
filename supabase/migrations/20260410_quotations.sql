-- ============================================================
-- 報價單系統 Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT '',
  client_name text DEFAULT '',
  client_logo text DEFAULT '',

  -- 報價明細 (JSONB array)
  items jsonb DEFAULT '[
    {"label":"講師費","type":"hourly","hours":4,"rate":8000,"subtotal":32000},
    {"label":"車馬費","type":"fixed","amount":0},
    {"label":"住宿費","type":"fixed","amount":0},
    {"label":"助理費","type":"perhead","count":0,"rate":3000,"subtotal":0},
    {"label":"影片錄製授權費","type":"fixed","amount":0}
  ]'::jsonb,

  total_amount integer DEFAULT 0,
  notes text DEFAULT '',
  custom_sections jsonb DEFAULT '[]'::jsonb,

  -- 付款資訊
  payment_method text DEFAULT '銀行匯款',
  payment_terms text DEFAULT '開課前全額付款',
  bank_info jsonb DEFAULT '{
    "bank":"",
    "branch":"",
    "account":"",
    "name":"數位簡報室"
  }'::jsonb,

  -- 課綱
  include_outline boolean DEFAULT true,

  -- 狀態
  status text DEFAULT 'draft',
  valid_until date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotations_project ON public.quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_quotations_slug ON public.quotations(slug);

-- RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Anon 可以用 slug 讀取（客戶端）
CREATE POLICY "Anon read quotations by slug" ON public.quotations
  FOR SELECT TO anon USING (true);

-- Authenticated 全權管理
CREATE POLICY "Auth manage quotations" ON public.quotations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = quotations.project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = quotations.project_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- updated_at trigger
CREATE TRIGGER quotations_update_timestamp
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$ BEGIN RAISE NOTICE '✅ quotations 表建立完成'; END $$;
