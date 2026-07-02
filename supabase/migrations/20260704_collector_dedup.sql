-- ============================================================
-- 資料收集器：防重複提交 + token 查詢加索引
-- 背景：多位學員同時使用時，Agent 若因網路瞬斷自動重試，或
-- 不小心重複執行同一段指令，會把同一筆客戶資料寫入兩次，
-- 讓排行榜筆數失真、對其他學員不公平。
-- ============================================================

-- 讓 trigger 用 token 查詢既有紀錄時走索引，而不是全表掃描
CREATE INDEX IF NOT EXISTS idx_collector_entries_token
  ON public.collector_entries(token);

-- 更新身份解析 trigger：同一個 token 已經送過完全相同的 data，
-- 靜默略過（RETURN NULL 讓這筆 insert 不落地），不視為錯誤、
-- 也不會重複計分。PostgREST 對這種情況仍回 2xx（body 為空陣列），
-- 呼叫端不需要特別處理。
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

  IF EXISTS (
    SELECT 1 FROM public.collector_entries
    WHERE token = NEW.token AND data = NEW.data
  ) THEN
    RETURN NULL;
  END IF;

  NEW.session_id := t.session_id;
  NEW.element_id := t.element_id;
  NEW.student_email := t.student_email;
  NEW.student_name := t.student_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$ BEGIN RAISE NOTICE '✅ Collector 防重複提交機制已套用'; END $$;
