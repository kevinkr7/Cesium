-- ============================================================================
-- CESIUM — MIGRATION 20261019000008: NOTIFICATIONS REALTIME & RLS HARDENING
-- Enables Realtime on connections & notifications, fixes conversation RLS recursion
-- ============================================================================

-- 1. Ensure public.connections and public.notifications are in supabase_realtime publication
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
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Non-recursive security definer helper to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conv_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Replace recursive policies on conversation_members and messages
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
