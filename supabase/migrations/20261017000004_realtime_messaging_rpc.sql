-- ============================================================================
-- CESIUM — MIGRATION 20261017000004: REALTIME MESSAGING & DIRECT CONVERSATION RPC
-- Enables Realtime on messages, direct conversation provisioning, and read receipts
-- ============================================================================

-- 1. Ensure public.messages is registered in supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignored if supabase_realtime publication is not configured in local/test runners
  NULL;
END $$;

-- 2. Transactional RPC: Get or Create Direct Conversation
CREATE OR REPLACE FUNCTION public.rpc_get_or_create_direct_conversation(p_peer_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_conn_status TEXT;
  v_conv_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller = p_peer_user_id THEN
    RAISE EXCEPTION 'Cannot initiate a conversation with yourself';
  END IF;

  -- 1. Ensure connection is active and accepted
  SELECT status INTO v_conn_status FROM public.connections
  WHERE (requester_id = v_caller AND addressee_id = p_peer_user_id)
     OR (requester_id = p_peer_user_id AND addressee_id = v_caller);

  IF v_conn_status IS NULL OR v_conn_status <> 'accepted' THEN
    RAISE EXCEPTION 'Active connection required to initiate direct conversation';
  END IF;

  -- 2. Ensure neither party has blocked the other
  IF EXISTS (
    SELECT 1 FROM public.blocked_users 
    WHERE (blocker_id = v_caller AND blocked_id = p_peer_user_id)
       OR (blocker_id = p_peer_user_id AND blocked_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'Communication with this user is blocked';
  END IF;

  -- 3. Check for existing bilateral conversation
  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = v_caller
  JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = p_peer_user_id
  LIMIT 1;

  -- 4. If none exists, create conversation and join both users
  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (created_at, updated_at)
    VALUES (now(), now())
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, joined_at, last_read_at)
    VALUES 
      (v_conv_id, v_caller, now(), now()),
      (v_conv_id, p_peer_user_id, now(), now());
  END IF;

  RETURN jsonb_build_object('success', true, 'conversation_id', v_conv_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Transactional RPC: Mark Conversation Read
CREATE OR REPLACE FUNCTION public.rpc_mark_conversation_read(p_conversation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.conversation_members
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = v_caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation member record not found';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
