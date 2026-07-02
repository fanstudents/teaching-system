-- ============================================================
-- Collector 模組（資料收集器 / 業務開發競賽儀表板）
-- 學員的外部 AI Agent 透過 HTTP POST 寫入資料，以 token 辨識身份
-- ============================================================

-- ══════════════════════════════════════
-- collector_tokens — 學員專屬寫入憑證
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.collector_tokens (
  token text PRIMARY KEY DEFAULT encode(gen_random_bytes(18), 'hex'),
  session_id text NOT NULL,
  element_id text NOT NULL,
  student_email text NOT NULL DEFAULT '',
  student_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collector_tokens_identity
  ON public.collector_tokens(session_id, element_id, student_email);
CREATE INDEX IF NOT EXISTS idx_collector_tokens_element
  ON public.collector_tokens(session_id, element_id);

ALTER TABLE public.collector_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access" ON public.collector_tokens;
CREATE POLICY "Allow anon full access" ON public.collector_tokens
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ══════════════════════════════════════
-- collector_entries — 外部 Agent POST 進來的資料
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.collector_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  session_id text NOT NULL DEFAULT '',
  element_id text NOT NULL DEFAULT '',
  student_email text NOT NULL DEFAULT '',
  student_name text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collector_entries_element
  ON public.collector_entries(session_id, element_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collector_entries_student
  ON public.collector_entries(session_id, element_id, student_email);

-- ── 核心機制：BEFORE INSERT trigger，用 token 覆寫真實身份 ──
-- 外部 Agent 只需要傳 token，不需要（也不被信任）自己傳身份欄位
CREATE OR REPLACE FUNCTION public.collector_entries_resolve_identity()
RETURNS TRIGGER AS $$
DECLARE
  t public.collector_tokens%ROWTYPE;
BEGIN
  IF NEW.token IS NULL OR NEW.token = '' THEN
    RAISE EXCEPTION 'collector_entries: 缺少 token，請確認 body 內有帶 "token" 欄位';
  END IF;

  SELECT * INTO t FROM public.collector_tokens WHERE token = NEW.token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'collector_entries: token 無效或已失效，請重新整理簡報頁面取得新的憑證';
  END IF;

  NEW.session_id := t.session_id;
  NEW.element_id := t.element_id;
  NEW.student_email := t.student_email;
  NEW.student_name := t.student_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_collector_entries_resolve_identity ON public.collector_entries;
CREATE TRIGGER trg_collector_entries_resolve_identity
  BEFORE INSERT ON public.collector_entries
  FOR EACH ROW EXECUTE FUNCTION public.collector_entries_resolve_identity();

ALTER TABLE public.collector_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access" ON public.collector_entries;
CREATE POLICY "Allow anon full access" ON public.collector_entries
  FOR ALL TO anon USING (true) WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '✅ Collector 模組資料表建立完成'; END $$;
