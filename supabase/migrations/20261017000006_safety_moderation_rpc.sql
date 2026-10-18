-- ============================================================================
-- CESIUM MIGRATION 20261017000006: Safety, Blocking & Content Moderation RPCs
-- ============================================================================
-- Additive idempotent migration defining content reports and transactional
-- RPCs for user blocking, unblocking, reporting, and content moderation.

-- 1. Create content_reports table for community posts & replies
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'reply')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_reports' AND policyname = 'content_reports_insert'
  ) THEN
    CREATE POLICY content_reports_insert ON public.content_reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_reports' AND policyname = 'content_reports_select'
  ) THEN
    CREATE POLICY content_reports_select ON public.content_reports
      FOR SELECT USING (auth.uid() = reporter_id);
  END IF;
END $$;

-- 2. Transactional RPC to block a user and sever existing connections
CREATE OR REPLACE FUNCTION public.rpc_block_user(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to block a user';
  END IF;

  IF v_caller = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  -- Insert into blocked_users idempotently
  INSERT INTO public.blocked_users (blocker_id, blocked_id)
  VALUES (v_caller, p_target_user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Sever any active or pending connection between the two users
  DELETE FROM public.connections
  WHERE (requester_id = v_caller AND recipient_id = p_target_user_id)
     OR (requester_id = p_target_user_id AND recipient_id = v_caller);

  RETURN jsonb_build_object('success', true, 'message', 'User blocked');
END;
$$;

-- 3. RPC to unblock a user
CREATE OR REPLACE FUNCTION public.rpc_unblock_user(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to unblock a user';
  END IF;

  DELETE FROM public.blocked_users
  WHERE blocker_id = v_caller AND blocked_id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'User unblocked');
END;
$$;

-- 4. RPC to report a user with validated input
CREATE OR REPLACE FUNCTION public.rpc_report_user(
  p_reported_user_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_report_id UUID;
  v_clean_reason TEXT := trim(p_reason);
  v_clean_details TEXT := trim(coalesce(p_details, ''));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to report a user';
  END IF;

  IF v_caller = p_reported_user_id THEN
    RAISE EXCEPTION 'Cannot report yourself';
  END IF;

  IF char_length(v_clean_reason) < 3 OR char_length(v_clean_reason) > 100 THEN
    RAISE EXCEPTION 'Report reason must be between 3 and 100 characters';
  END IF;

  IF char_length(v_clean_details) > 1000 THEN
    RAISE EXCEPTION 'Report details must not exceed 1000 characters';
  END IF;

  INSERT INTO public.user_reports (reporter_id, reported_user_id, reason, details)
  VALUES (v_caller, p_reported_user_id, v_clean_reason, v_clean_details)
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- 5. RPC to report community content (post or reply)
CREATE OR REPLACE FUNCTION public.rpc_report_content(
  p_content_type TEXT,
  p_content_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_report_id UUID;
  v_clean_reason TEXT := trim(p_reason);
  v_clean_details TEXT := trim(coalesce(p_details, ''));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to report content';
  END IF;

  IF p_content_type NOT IN ('post', 'reply') THEN
    RAISE EXCEPTION 'Invalid content_type; must be "post" or "reply"';
  END IF;

  IF char_length(v_clean_reason) < 3 OR char_length(v_clean_reason) > 100 THEN
    RAISE EXCEPTION 'Report reason must be between 3 and 100 characters';
  END IF;

  IF char_length(v_clean_details) > 1000 THEN
    RAISE EXCEPTION 'Report details must not exceed 1000 characters';
  END IF;

  INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason, details)
  VALUES (v_caller, p_content_type, p_content_id, v_clean_reason, v_clean_details)
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- 6. RPC to list blocked users for authenticated caller
CREATE OR REPLACE FUNCTION public.rpc_get_blocked_users()
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  handle TEXT,
  avatar_url TEXT,
  blocked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.handle::text,
    p.avatar_path AS avatar_url,
    b.created_at AS blocked_at
  FROM public.blocked_users b
  JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.rpc_block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_report_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_report_content(TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_blocked_users() TO authenticated;
