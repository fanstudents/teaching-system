-- ============================================================
-- Fix: Portal 頁面 authenticated 使用者無法查詢 projects
--
-- 問題：學員若有 Supabase auth token（如 Google 登入殘留），
--       請求會以 authenticated role 送出，但 projects 表只有
--       owner/admin 的 authenticated policy，導致非 owner 的
--       authenticated user 查不到任何 project。
--
-- 解法：新增 authenticated SELECT policy，讓任何登入使用者
--       都可以 SELECT projects（與 anon 相同的讀取權限）。
-- ============================================================

-- 允許任何 authenticated user 讀取 projects（學員端 / portal 需要）
DROP POLICY IF EXISTS "Authenticated read projects" ON public.projects;
CREATE POLICY "Authenticated read projects"
  ON public.projects
  FOR SELECT TO authenticated
  USING (true);

-- 同樣修復 project_sessions（portal 也需要讀取場次資料）
DROP POLICY IF EXISTS "Authenticated read sessions" ON public.project_sessions;
CREATE POLICY "Authenticated read sessions"
  ON public.project_sessions
  FOR SELECT TO authenticated
  USING (true);
