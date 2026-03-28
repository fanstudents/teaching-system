-- ══════════════════════════════════════
-- 講師評分 RPC — SECURITY DEFINER
-- 直接在 DB 端用 jsonb_set 更新 state._awarded
-- 繞過所有 PostgREST 序列化和 RLS 問題
-- ══════════════════════════════════════

CREATE OR REPLACE FUNCTION public.instructor_score_submission(
  p_submission_id uuid,
  p_score int,
  p_session_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_old_state jsonb;
  v_new_state jsonb;
  v_result jsonb;
BEGIN
  -- 讀取現有 state
  SELECT COALESCE(state::jsonb, '{}'::jsonb)
    INTO v_old_state
    FROM public.submissions
    WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'submission not found');
  END IF;

  -- 合併新的 _awarded 和 metadata
  v_new_state := v_old_state
    || jsonb_build_object(
         '_awarded', p_score,
         '_maxPts', 5,
         '_instructorScored', true,
         '_scoredAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       );

  -- 更新 DB（同時更新 session_id 確保排行榜能查到）
  IF p_session_id IS NOT NULL THEN
    UPDATE public.submissions
      SET state = v_new_state,
          score = p_score::text,
          session_id = p_session_id
      WHERE id = p_submission_id;
  ELSE
    UPDATE public.submissions
      SET state = v_new_state,
          score = p_score::text
      WHERE id = p_submission_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'old_awarded', COALESCE((v_old_state->>'_awarded')::int, 0),
    'new_awarded', p_score,
    'submission_id', p_submission_id::text,
    'session_id', COALESCE(p_session_id, 'unchanged')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 允許 anon 和 authenticated 呼叫
GRANT EXECUTE ON FUNCTION public.instructor_score_submission(uuid, int, text) TO anon;
GRANT EXECUTE ON FUNCTION public.instructor_score_submission(uuid, int, text) TO authenticated;

DO $$ BEGIN RAISE NOTICE '✅ instructor_score_submission RPC 建立完成'; END $$;
