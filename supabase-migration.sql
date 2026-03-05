-- ============================================================
-- InsForge → Supabase 遷移 SQL
-- 在 Supabase SQL Editor 中執行此檔案
-- ============================================================

-- ── updated_at trigger function ──
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════
-- 1. organizations (被 projects FK 引用)
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  line_channel_id text DEFAULT '',
  line_channel_secret text DEFAULT '',
  line_channel_access_token text DEFAULT '',
  contact_email text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════
-- 2. projects
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  current_phase text DEFAULT 'pre-class',
  created_at timestamp DEFAULT now(),
  description text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  course_type text DEFAULT 'ai-workplace',
  slides_data jsonb DEFAULT '{}',
  course_link text DEFAULT '',
  instructor text NOT NULL DEFAULT '',
  organization text NOT NULL DEFAULT '',
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  course_id text DEFAULT '',
  purchase_link text DEFAULT '',
  slide_mode text NOT NULL DEFAULT 'internal',
  type text NOT NULL DEFAULT 'course',
  transcript text DEFAULT '',
  summary_content jsonb DEFAULT '{}',
  login_fields jsonb
);
CREATE INDEX IF NOT EXISTS idx_projects_course_id ON public.projects(course_id) WHERE course_id <> '';
CREATE INDEX IF NOT EXISTS idx_projects_type ON public.projects(type);

-- ══════════════════════════════════════
-- 3. project_sessions
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.project_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_code text NOT NULL UNIQUE,
  join_code text DEFAULT '',
  date text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT '09:30 — 16:30',
  venue text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  current_phase text NOT NULL DEFAULT 'pre-class',
  pre_survey_enabled boolean DEFAULT false,
  pre_class_notes text DEFAULT '',
  venue_address text DEFAULT '',
  post_email_template jsonb DEFAULT '{}',
  student_portal_url text DEFAULT '',
  max_capacity integer DEFAULT 0,
  session_format text NOT NULL DEFAULT 'onsite',
  stream_url text DEFAULT '',
  transport_info text DEFAULT '',
  reminders text DEFAULT '',
  group_link_url text DEFAULT '',
  group_link_label text DEFAULT ''
);

-- ══════════════════════════════════════
-- 4. sessions (即時廣播用)
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL UNIQUE,
  title text,
  current_slide text,
  is_broadcasting text,
  project_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Migration: add project_id if not exists
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS project_id text DEFAULT '';
CREATE TRIGGER sessions_update_timestamp
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ══════════════════════════════════════
-- 5. students
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  group_name text DEFAULT '',
  session_code text DEFAULT '',
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  project_id text DEFAULT '',
  company text DEFAULT '',
  order_id text DEFAULT '',
  purchase_id uuid,
  registration_status text NOT NULL DEFAULT 'registered',
  registered_at timestamptz,
  attended_at timestamptz,
  session_id uuid REFERENCES public.project_sessions(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS students_email_project_key ON public.students(email, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS students_email_session_key ON public.students(email, session_code);
CREATE INDEX IF NOT EXISTS idx_students_session_id ON public.students(session_id);

-- ══════════════════════════════════════
-- 6. submissions
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  student_name text NOT NULL,
  assignment_title text NOT NULL,
  type text NOT NULL,
  content text,
  file_url text,
  file_key text,
  is_correct boolean,
  score text,
  submitted_at text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  student_email text DEFAULT '',
  student_group text DEFAULT '',
  element_id text DEFAULT '',
  state jsonb DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_interaction
  ON public.submissions(session_id, element_id, student_email)
  WHERE element_id <> '' AND element_id IS NOT NULL;
CREATE TRIGGER submissions_update_timestamp
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ══════════════════════════════════════
-- 7. purchases
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL DEFAULT '',
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  order_id text UNIQUE,
  phone text DEFAULT '',
  amount numeric DEFAULT 0,
  raw_data jsonb DEFAULT '{}',
  synced_to_session boolean DEFAULT false,
  session_id uuid,
  created_at timestamptz DEFAULT now(),
  payment_state text NOT NULL DEFAULT 'paid',
  refunded_amount numeric DEFAULT 0,
  paid_at timestamptz,
  type text NOT NULL DEFAULT '',
  coupon_name text NOT NULL DEFAULT '',
  buyer_name text DEFAULT '',
  buyer_email text DEFAULT '',
  product_name text DEFAULT '',
  product_id text DEFAULT '',
  quantity integer DEFAULT 1,
  currency text DEFAULT 'TWD',
  payment_method text DEFAULT '',
  invoice_number text DEFAULT '',
  note text DEFAULT '',
  company text DEFAULT '',
  address text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_course_id ON public.purchases(course_id);

-- ══════════════════════════════════════
-- 8. affiliates
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  coupon_code text NOT NULL,
  bank_name text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  channels text NOT NULL DEFAULT '',
  channel_detail text NOT NULL DEFAULT '',
  login_token text NOT NULL DEFAULT '',
  commission_rate numeric NOT NULL DEFAULT 0.10,
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON public.affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates(status);

-- ══════════════════════════════════════
-- 9. checklist_items
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text DEFAULT '',
  title text NOT NULL,
  description text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════
-- 10. checklist_progress
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.checklist_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text NOT NULL,
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_email, checklist_item_id)
);

-- ══════════════════════════════════════
-- 11. email_drafts
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text NOT NULL,
  session_code text DEFAULT '',
  subject text DEFAULT '',
  body text DEFAULT '',
  status text DEFAULT 'draft',
  generated_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- ══════════════════════════════════════
-- 12. email_subscribers
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  name text,
  source text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert" ON public.email_subscribers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated read" ON public.email_subscribers FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════
-- 13. enterprise_inquiries
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.enterprise_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text,
  headcount text,
  contact_name text,
  email text,
  phone text,
  line_id text,
  requirements text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.enterprise_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert" ON public.enterprise_inquiries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated read" ON public.enterprise_inquiries FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════
-- 14. exam_responses
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.exam_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  student_email text NOT NULL,
  student_name text NOT NULL,
  course_type text DEFAULT 'ai-workplace',
  answers jsonb DEFAULT '[]',
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════
-- 15. instructors
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  course_ids text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_instructors_email ON public.instructors(email);

-- ══════════════════════════════════════
-- 16. poll_votes
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id serial PRIMARY KEY,
  session_code text NOT NULL,
  element_id text NOT NULL,
  student_email text,
  student_name text,
  option_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_session_element ON public.poll_votes(session_code, element_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_student ON public.poll_votes(session_code, element_id, student_email);

-- ══════════════════════════════════════
-- 17. satisfaction_responses
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.satisfaction_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  student_email text NOT NULL,
  student_name text NOT NULL,
  responses jsonb DEFAULT '{}',
  nps_score integer DEFAULT 0,
  avg_rating real DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════
-- 18. session_assignments
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.session_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.project_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  due_date timestamptz,
  type text NOT NULL DEFAULT 'text',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════
-- 19. survey_questions
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text DEFAULT '',
  question_type text NOT NULL DEFAULT 'choice',
  question_text text NOT NULL,
  options jsonb DEFAULT '[]',
  correct_answer text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════
-- 20. survey_responses
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text NOT NULL,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  answer text DEFAULT '',
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(student_email, question_id)
);

-- ══════════════════════════════════════
-- 21. system_prompts
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.system_prompts (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  prompt_text text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════
-- 22. wish_list
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.wish_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  city text,
  time_preference text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.wish_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert" ON public.wish_list FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated read" ON public.wish_list FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════
-- 全域 RLS：對大部分 table 開啟 anon 讀寫
-- 因為原系統沒用 RLS，這裡用 permissive policy
-- ══════════════════════════════════════
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'organizations','projects','project_sessions','sessions','students',
      'submissions','purchases','affiliates','checklist_items','checklist_progress',
      'email_drafts','exam_responses','instructors','poll_votes',
      'satisfaction_responses','session_assignments','survey_questions',
      'survey_responses','system_prompts'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Allow anon full access" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- 也給 homework storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('homework', 'homework', true)
ON CONFLICT (id) DO NOTHING;
