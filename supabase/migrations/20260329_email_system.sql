-- ══════════════════════════════════════
-- Email 系統升級：開信追蹤 + 排程追蹤信
-- ══════════════════════════════════════

-- 1. 開信追蹤事件表
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES public.email_drafts(id) ON DELETE SET NULL,
  student_email text NOT NULL,
  event_type text NOT NULL DEFAULT 'open',
  ip_address text DEFAULT '',
  user_agent text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_draft ON public.email_events(draft_id);
CREATE INDEX IF NOT EXISTS idx_email_events_student ON public.email_events(student_email);

-- 2. 排程信件表
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.project_sessions(id) ON DELETE CASCADE,
  student_email text NOT NULL,
  student_name text NOT NULL DEFAULT '',
  email_type text NOT NULL DEFAULT 'followup_7d',
  delay_days integer NOT NULL DEFAULT 7,
  subject text DEFAULT '',
  body text DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON public.scheduled_emails(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_session ON public.scheduled_emails(session_id);

-- 3. email_drafts 加 open tracking 欄位
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.project_sessions(id) ON DELETE SET NULL;

-- 4. RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_email_events" ON public.email_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_scheduled_emails" ON public.scheduled_emails FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. pg_cron: 每小時執行排程檢查（需在 Supabase Dashboard SQL Editor 執行）
-- SELECT cron.schedule(
--   'process-scheduled-emails',
--   '0 * * * *',  -- 每小時整點
--   $$SELECT net.http_post(
--     url := 'https://wsaknnhjgiqmkendeyrj.supabase.co/functions/v1/process-scheduled',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--     ),
--     body := '{}'::jsonb
--   )$$
-- );

DO $$ BEGIN RAISE NOTICE '✅ email_events + scheduled_emails 表已建立'; END $$;
