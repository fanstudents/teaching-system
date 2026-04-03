-- ══════════════════════════════════════
-- 學員課後請求表 (問題發問 / 專案合作 / 合作引薦)
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.student_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text NOT NULL,
  student_name text NOT NULL DEFAULT '',
  session_code text DEFAULT '',
  project_name text DEFAULT '',
  request_type text NOT NULL CHECK (request_type IN ('question', 'collaboration', 'referral')),
  subject text DEFAULT '',
  message text NOT NULL,
  company text DEFAULT '',
  phone text DEFAULT '',
  referral_target text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'closed')),
  admin_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_requests_email ON public.student_requests(student_email);
CREATE INDEX IF NOT EXISTS idx_student_requests_type ON public.student_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_student_requests_status ON public.student_requests(status);

-- RLS
ALTER TABLE public.student_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_student_requests" ON public.student_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_student_requests" ON public.student_requests FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_student_requests" ON public.student_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '✅ student_requests 表已建立'; END $$;
