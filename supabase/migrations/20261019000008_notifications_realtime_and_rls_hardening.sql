-- ============================================================================
-- CESIUM — MIGRATION 20261019000008: NOTIFICATIONS REALTIME & RLS HARDENING
-- Enables Realtime on connections & notifications, fixes conversation RLS recursion,
-- ensures REPLICA IDENTITY FULL for logical filters, and hardens connection RPCs.
-- ============================================================================

-- 1. Ensure REPLICA IDENTITY FULL for reliable Supabase Realtime row filtering
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;

-- 2. Ensure public.connections and public.notifications are in supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Non-recursive security definer helper to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conv_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Replace recursive policies on conversation_members and messages
DO $$
BEGIN
  -- Recreate conv_members_select without self-recursion
  DROP POLICY IF EXISTS conv_members_select ON public.conversation_members;
  CREATE POLICY conv_members_select ON public.conversation_members
    FOR SELECT USING (
      user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid())
    );

  -- Recreate messages_select using security definer check
  DROP POLICY IF EXISTS messages_select ON public.messages;
  CREATE POLICY messages_select ON public.messages
    FOR SELECT USING (
      public.is_conversation_member(conversation_id, auth.uid())
    );

  -- Recreate messages_insert using security definer check
  DROP POLICY IF EXISTS messages_insert ON public.messages;
  CREATE POLICY messages_insert ON public.messages
    FOR INSERT WITH CHECK (
      auth.uid() = sender_id
      AND public.is_conversation_member(conversation_id, auth.uid())
    );
END $$;

-- 5. Hardened Transactional Connection Request with Notification Trigger
CREATE OR REPLACE FUNCTION public.rpc_send_connection_request(p_target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_existing RECORD;
  v_new_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot connect to self';
  END IF;

  -- Verify neither has blocked the other
  IF EXISTS (
    SELECT 1 FROM public.blocked_users 
    WHERE (blocker_id = v_caller AND blocked_id = p_target_user_id)
       OR (blocker_id = p_target_user_id AND blocked_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'Unable to connect to this user';
  END IF;

  -- Check existing connection record between this pair
  SELECT * INTO v_existing FROM public.connections
  WHERE (requester_id = v_caller AND addressee_id = p_target_user_id)
     OR (requester_id = p_target_user_id AND addressee_id = v_caller);

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', true, 'status', 'accepted', 'id', v_existing.id);
    ELSIF v_existing.status = 'pending' THEN
      RETURN jsonb_build_object('success', true, 'status', 'pending', 'id', v_existing.id);
    ELSE
      -- Re-open canceled or declined request
      UPDATE public.connections
      SET requester_id = v_caller, addressee_id = p_target_user_id, status = 'pending', updated_at = now()
      WHERE id = v_existing.id
      RETURNING id INTO v_new_id;
    END IF;
  ELSE
    INSERT INTO public.connections (requester_id, addressee_id, status)
    VALUES (v_caller, p_target_user_id, 'pending')
    RETURNING id INTO v_new_id;
  END IF;

  -- Insert Realtime Notification for addressee
  INSERT INTO public.notifications (user_id, type, title, payload)
  VALUES (
    p_target_user_id,
    'connection_request',
    'New connection request',
    jsonb_build_object('requester_id', v_caller, 'connection_id', v_new_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'pending', 'id', v_new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Hardened Transactional Connection Response with Accepted Notification
CREATE OR REPLACE FUNCTION public.rpc_respond_to_connection_request(p_connection_id UUID, p_status TEXT)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_conn RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid status response';
  END IF;

  SELECT * INTO v_conn FROM public.connections WHERE id = p_connection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  IF v_conn.addressee_id <> v_caller THEN
    RAISE EXCEPTION 'Unauthorized to respond to this request';
  END IF;

  UPDATE public.connections
  SET status = p_status, updated_at = now()
  WHERE id = p_connection_id;

  -- Create Notification for requester if accepted
  IF p_status = 'accepted' THEN
    INSERT INTO public.notifications (user_id, type, title, payload)
    VALUES (
      v_conn.requester_id,
      'connection_accepted',
      'Connection accepted',
      jsonb_build_object('responder_id', v_caller, 'connection_id', p_connection_id)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Ensure permissive RLS policies for notifications and connections
DO $$
BEGIN
  -- Notifications policies
  DROP POLICY IF EXISTS notifications_insert ON public.notifications;
  CREATE POLICY notifications_insert ON public.notifications
    FOR INSERT WITH CHECK (
      auth.role() = 'authenticated'
      AND (
        auth.uid() = user_id
        OR type = 'connection_request'
        OR EXISTS (
          SELECT 1 FROM public.connections c
          WHERE (c.requester_id = auth.uid() AND c.addressee_id = notifications.user_id)
             OR (c.addressee_id = auth.uid() AND c.requester_id = notifications.user_id)
        )
      )
    );

  DROP POLICY IF EXISTS notifications_select ON public.notifications;
  CREATE POLICY notifications_select ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS notifications_update ON public.notifications;
  CREATE POLICY notifications_update ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Connections policies
  DROP POLICY IF EXISTS connections_select ON public.connections;
  CREATE POLICY connections_select ON public.connections
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

  DROP POLICY IF EXISTS connections_insert ON public.connections;
  CREATE POLICY connections_insert ON public.connections
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

  DROP POLICY IF EXISTS connections_update ON public.connections;
  CREATE POLICY connections_update ON public.connections
    FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
END $$;

