-- ══════════════════════════════════════
-- 講師評分 RPC — SECURITY DEFINER
-- 直接在 DB 端用 jsonb_set 更新 state._awarded
-- 繞過所有 PostgREST 序列化和 RLS 問題
-- ══════════════════════════════════════

CREATE OR REPLACE FUNCTION public.instructor_score_submission(
  p_submission_id uuid,
  p_score int,
  p_session_id text DEFAULT NULL,
  p_student_email text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_old_state jsonb;
  v_new_state jsonb;
  v_current_email text;
BEGIN
  -- 讀取現有 state + email
  SELECT COALESCE(state::jsonb, '{}'::jsonb), COALESCE(student_email, '')
    INTO v_old_state, v_current_email
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

  -- 更新 DB（同時修補 session_id 和 student_email）
  UPDATE public.submissions
    SET state = v_new_state,
        score = p_score::text,
        session_id = COALESCE(p_session_id, session_id),
        student_email = CASE
          WHEN (v_current_email IS NULL OR v_current_email = '') AND p_student_email IS NOT NULL
          THEN p_student_email
          ELSE student_email
        END
    WHERE id = p_submission_id;

  RETURN jsonb_build_object(
    'ok', true,
    'old_awarded', COALESCE((v_old_state->>'_awarded')::int, 0),
    'new_awarded', p_score,
    'session_id', COALESCE(p_session_id, 'unchanged'),
    'email_fixed', (v_current_email IS NULL OR v_current_email = '') AND p_student_email IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 允許 anon 和 authenticated 呼叫
GRANT EXECUTE ON FUNCTION public.instructor_score_submission(uuid, int, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.instructor_score_submission(uuid, int, text, text) TO authenticated;

DO $$ BEGIN RAISE NOTICE '✅ instructor_score_submission RPC 建立完成'; END $$;
