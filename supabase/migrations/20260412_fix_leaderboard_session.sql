-- =====================================================
-- 修正 get_leaderboard：場次隔離
-- 
-- 問題：UNION ALL 第二段用 project_id 撈 students 表，
--       導致同一專案的所有場次學員全部混在排行榜。
--
-- 解法：
-- 1. 如果 p_session_id 是場次 UUID → 只查 submissions
--    (學員加入時已自動寫入 _join_bonus submission，不需 students 表補齊)
-- 2. 如果 p_session_id 是 join_code → 保留原行為（相容舊場次）
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_session_id text,
  p_project_id text DEFAULT NULL
)
RETURNS TABLE(
  name text,
  email text,
  total_points int
) AS $$
DECLARE
  v_is_uuid boolean;
BEGIN
  -- 判斷 p_session_id 是場次 UUID 還是 join_code
  -- UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  v_is_uuid := (p_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

  RETURN QUERY
  -- Part 1: 聚合 submissions 中的 _awarded 分數
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

  -- Part 2: 補齊已註冊但尚無互動的學員（0 分）
  -- ★ 僅在 join_code 模式下啟用（相容舊場次）
  -- UUID 模式不需要，因為 _join_bonus submission 已確保出席學員在 Part 1 出現
  SELECT
    st.name::text,
    st.email::text,
    0::int
  FROM public.students st
  WHERE NOT v_is_uuid  -- ★ 只在 join_code 模式啟用
    AND p_project_id IS NOT NULL
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

DO $$ BEGIN RAISE NOTICE '✅ get_leaderboard 已修正：UUID 模式只查 submissions，場次隔離完成'; END $$;
