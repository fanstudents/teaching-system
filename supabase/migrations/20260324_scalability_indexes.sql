-- ============================================================
-- 50人規模壓力優化 — 索引 + Unique Constraint + 排行榜 RPC
-- 在 Supabase SQL Editor 中執行
-- ============================================================

-- ══════════════════════════════════════
-- 1. submissions 索引（所有互動模組的熱查詢路徑）
-- ══════════════════════════════════════

-- 最常用：stateManager.save/load (session_id + element_id + student_email)
CREATE INDEX IF NOT EXISTS idx_submissions_session_element_email
  ON public.submissions(session_id, element_id, student_email);

-- 排行榜：只靠 session_id 過濾
CREATE INDEX IF NOT EXISTS idx_submissions_session_id
  ON public.submissions(session_id);

-- Showcase：靠 assignment_title + session_id
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_session
  ON public.submissions(assignment_title, session_id);

-- Buzzer：靠 element_id + created_at 排序
CREATE INDEX IF NOT EXISTS idx_submissions_element_created
  ON public.submissions(element_id, created_at);

-- Unique constraint（配合 upsert，防止重複寫入）
-- 注意：如果已存在重複資料需先清理
DO $$
BEGIN
  -- 先清除可能存在的重複紀錄（保留最新的）
  DELETE FROM public.submissions a
  USING public.submissions b
  WHERE a.id < b.id
    AND a.session_id = b.session_id
    AND a.element_id = b.element_id
    AND a.student_email = b.student_email
    AND a.session_id IS NOT NULL
    AND a.element_id IS NOT NULL
    AND a.student_email IS NOT NULL
    AND a.student_email != '';

  -- 加上 unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_submissions_session_element_email'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT uq_submissions_session_element_email
      UNIQUE (session_id, element_id, student_email);
  END IF;
END $$;

-- ══════════════════════════════════════
-- 2. poll_votes 索引
-- ══════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_poll_votes_session_element
  ON public.poll_votes(session_code, element_id);

-- ══════════════════════════════════════
-- 3. 排行榜 RPC Function（DB 端聚合，避免前端拉全表）
-- ══════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_session_id text,
  p_project_id text DEFAULT NULL
)
RETURNS TABLE(
  name text,
  email text,
  total_points int
) AS $$
BEGIN
  RETURN QUERY
  -- 聚合 submissions 中的 _awarded 分數
  SELECT
    s.student_name::text AS name,
    s.student_email::text AS email,
    COALESCE(SUM(
      CASE
        WHEN s.state IS NOT NULL THEN (s.state->>'_awarded')::int
        ELSE 0
      END
    ), 0)::int AS total_points
  FROM public.submissions s
  WHERE s.session_id = p_session_id
    AND s.student_email IS NOT NULL
    AND s.student_email != 'guest'
    AND s.student_email != ''
  GROUP BY s.student_email, s.student_name

  UNION ALL

  -- 補齊已註冊但尚無互動的學員（0 分）
  SELECT
    st.name::text,
    st.email::text,
    0::int
  FROM public.students st
  WHERE p_project_id IS NOT NULL
    AND st.project_id::text = p_project_id
    AND st.email IS NOT NULL
    AND st.email != ''
    AND NOT EXISTS (
      SELECT 1 FROM public.submissions sub
      WHERE sub.session_id = p_session_id
        AND sub.student_email = st.email
    )

  ORDER BY total_points DESC, name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 完成提示
DO $$ BEGIN RAISE NOTICE '✅ 50人規模優化 migration 完成'; END $$;
