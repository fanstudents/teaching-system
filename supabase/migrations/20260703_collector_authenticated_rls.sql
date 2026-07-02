-- ============================================================
-- 修補 Collector 模組的 RLS：補上 authenticated 角色政策
-- 20260702_collector.sql 只給 anon 角色開放，但已登入學員的瀏覽器
-- 請求是用自己的 JWT（Postgres role = authenticated，不是 anon），
-- 導致 db.insert('collector_tokens', ...) 被 RLS 擋掉，
-- 學員端顯示「無法取得寫入憑證」。
-- 比照 20260318_fix_authenticated_rls.sql 的既有修法補上。
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated full access" ON public.collector_tokens;
CREATE POLICY "Allow authenticated full access" ON public.collector_tokens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access" ON public.collector_entries;
CREATE POLICY "Allow authenticated full access" ON public.collector_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '✅ Collector 模組 authenticated RLS 修補完成'; END $$;
