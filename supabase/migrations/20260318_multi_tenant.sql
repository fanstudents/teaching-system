-- ============================================================
-- 多租戶講師系統 Migration
-- 在 Supabase SQL Editor 中執行
-- ============================================================

-- ══════════════════════════════════════
-- 1. user_profiles（角色與身份）
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'instructor',  -- 'super_admin' | 'instructor'
  avatar_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- RLS for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 每個使用者可以讀取自己的 profile
CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Super admin 可以讀取所有 profiles
CREATE POLICY "Admin reads all profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'super_admin')
  );

-- 只有 super admin 可以建立/更新 profiles
CREATE POLICY "Admin manages profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'super_admin')
  );

-- 使用者可以更新自己的 display_name 和 avatar_url
CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- updated_at trigger
CREATE TRIGGER user_profiles_update_timestamp
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ══════════════════════════════════════
-- 2. projects 表新增 owner_id
-- ══════════════════════════════════════
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);

-- ══════════════════════════════════════
-- 3. 建立 super_admin profile
--    ⚠️ 需要先確認 service@tbr.digital 的 auth.users id
--    執行方式：先查出 id，再 insert
-- ══════════════════════════════════════

-- 把 super_admin 的 profile 插入
INSERT INTO public.user_profiles (id, email, display_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', '管理者'), 'super_admin'
FROM auth.users
WHERE email = 'service@tbr.digital'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- 把現有所有專案歸給 super_admin
UPDATE public.projects
SET owner_id = (SELECT id FROM auth.users WHERE email = 'service@tbr.digital')
WHERE owner_id IS NULL;

-- ══════════════════════════════════════
-- 4. 更新 RLS 策略 — projects
-- ══════════════════════════════════════

-- 移除舊的全開放 policy
DROP POLICY IF EXISTS "Allow anon full access" ON public.projects;

-- 講師看自己的專案
CREATE POLICY "Owner access own projects" ON public.projects
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Super admin 看全部
CREATE POLICY "Admin access all projects" ON public.projects
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 保留 anon 讀取（學生端需要用 join_code 查詢專案）
CREATE POLICY "Anon read projects by join_code" ON public.projects
  FOR SELECT TO anon
  USING (true);

-- ══════════════════════════════════════
-- 5. 更新 RLS 策略 — project_sessions
-- ══════════════════════════════════════

DROP POLICY IF EXISTS "Allow anon full access" ON public.project_sessions;

-- 講師透過 project 的 owner_id 存取
CREATE POLICY "Owner access own sessions" ON public.project_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_sessions.project_id AND projects.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_sessions.project_id AND projects.owner_id = auth.uid())
  );

-- Super admin 看全部
CREATE POLICY "Admin access all sessions" ON public.project_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 學生端保持 anon 讀取
CREATE POLICY "Anon read sessions" ON public.project_sessions
  FOR SELECT TO anon
  USING (true);

-- ══════════════════════════════════════
-- 6. 其他表保持 anon 讀寫（學生端使用）
--    students, submissions, poll_votes, etc. 不修改
-- ══════════════════════════════════════

-- 完成提示
DO $$ BEGIN RAISE NOTICE '✅ 多租戶 migration 完成'; END $$;
