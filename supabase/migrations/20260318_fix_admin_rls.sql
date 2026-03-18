-- ============================================================
-- 修補：projects / project_sessions 的 admin 策略
-- 問題：admin policy 的子查詢查 user_profiles，
--       但 user_profiles 自己也有 RLS → 循環導致查不到
-- 解法：用 SECURITY DEFINER function 繞過 RLS
-- ============================================================

-- 1. 建立 helper function（繞過 RLS 檢查角色）
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 2. 重建 projects 的 admin 策略
DROP POLICY IF EXISTS "Admin access all projects" ON public.projects;
CREATE POLICY "Admin access all projects" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 3. 重建 project_sessions 的 admin 策略
DROP POLICY IF EXISTS "Admin access all sessions" ON public.project_sessions;
CREATE POLICY "Admin access all sessions" ON public.project_sessions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4. 也修 user_profiles 的 admin 策略（同樣的循環問題）
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.user_profiles;
CREATE POLICY "Admin reads all profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Admin manages profiles" ON public.user_profiles;
CREATE POLICY "Admin manages profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DO $$ BEGIN RAISE NOTICE '✅ SECURITY DEFINER 修補完成'; END $$;
