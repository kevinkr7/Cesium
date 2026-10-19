-- ============================================================================
-- CESIUM DATABASE ADDITIVE MIGRATION: 20261017000007_production_hardening_rls.sql
-- Production Hardening: Row Level Security Defense-in-Depth, Connection Guarding,
-- Storage Bucket Isolation, and Input Integrity
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES HARDENING: Self-Deletion & Connection Mutual Visibility
-- ----------------------------------------------------------------------------

-- Allow authenticated users to delete their own account/profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete'
  ) THEN
    CREATE POLICY profiles_delete ON public.profiles
      FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;

-- Allow accepted connection partners to view each other's profiles even if discoverable = FALSE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_connections'
  ) THEN
    CREATE POLICY profiles_select_connections ON public.profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.connections c 
          WHERE c.status = 'accepted' 
            AND ((c.requester_id = auth.uid() AND c.addressee_id = profiles.id)
              OR (c.addressee_id = auth.uid() AND c.requester_id = profiles.id))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. CONNECTIONS HARDENING: Deletion & Anti-Tampering Trigger
-- ----------------------------------------------------------------------------

-- Allow connection parties to delete/sever a connection
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'connections' AND policyname = 'connections_delete'
  ) THEN
    CREATE POLICY connections_delete ON public.connections
      FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
  END IF;
END $$;

-- Anti-tampering trigger: prevent a requester from force-accepting their own connection request
CREATE OR REPLACE FUNCTION public.check_connection_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.requester_id THEN
      RAISE EXCEPTION 'Requester cannot accept their own connection request';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_connection_status ON public.connections;
CREATE TRIGGER trg_check_connection_status
  BEFORE UPDATE OF status ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.check_connection_status_transition();

-- ----------------------------------------------------------------------------
-- 3. MESSAGES HARDENING: Author Deletion
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_delete'
  ) THEN
    CREATE POLICY messages_delete ON public.messages
      FOR DELETE USING (auth.uid() = sender_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. CONVERSATIONS & MEMBERS HARDENING: Lifecycle & Leaving
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_delete'
  ) THEN
    CREATE POLICY conversations_delete ON public.conversations
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.conversation_members cm 
          WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversation_members' AND policyname = 'conv_members_update'
  ) THEN
    CREATE POLICY conv_members_update ON public.conversation_members
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversation_members' AND policyname = 'conv_members_delete'
  ) THEN
    CREATE POLICY conv_members_delete ON public.conversation_members
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. COMMUNITIES & MEMBERS HARDENING: Creator Deletion & Member Management
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'communities' AND policyname = 'communities_delete'
  ) THEN
    CREATE POLICY communities_delete ON public.communities
      FOR DELETE USING (auth.uid() = creator_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'community_members' AND policyname = 'comm_members_update'
  ) THEN
    CREATE POLICY comm_members_update ON public.community_members
      FOR UPDATE USING (
        auth.uid() = user_id 
        OR EXISTS (
          SELECT 1 FROM public.communities c 
          WHERE c.id = community_members.community_id AND c.creator_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. INTERESTS HARDENING: Custom Interest Updates & Deletion
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'interests' AND policyname = 'interests_update'
  ) THEN
    CREATE POLICY interests_update ON public.interests
      FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'interests' AND policyname = 'interests_delete'
  ) THEN
    CREATE POLICY interests_delete ON public.interests
      FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. NOTIFICATIONS HARDENING: Prevent Spurious Notification Injection
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_insert'
  ) THEN
    CREATE POLICY notifications_insert ON public.notifications
      FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND (
          auth.uid() = user_id
          OR EXISTS (
            SELECT 1 FROM public.connections c
            WHERE (c.requester_id = auth.uid() AND c.addressee_id = notifications.user_id)
               OR (c.addressee_id = auth.uid() AND c.requester_id = notifications.user_id)
          )
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKET HARDENING: Authenticated User Isolation on public_assets
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    -- Ensure bucket exists and has correct constraints
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'public_assets',
      'public_assets',
      true,
      5242880,
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    -- Replace open insert policy with strict user folder isolation
    DROP POLICY IF EXISTS public_assets_insert ON storage.objects;
    CREATE POLICY public_assets_insert ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'public_assets'
        AND auth.role() = 'authenticated'
        AND (
          name LIKE 'avatars/' || (auth.uid())::text || '/%'
          OR name LIKE 'uploads/' || (auth.uid())::text || '/%'
          OR (auth.uid() = owner)
        )
      );

    -- Ensure users can only update objects in their own folder
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_assets_update'
    ) THEN
      CREATE POLICY public_assets_update ON storage.objects
        FOR UPDATE USING (
          bucket_id = 'public_assets'
          AND (
            name LIKE 'avatars/' || (auth.uid())::text || '/%'
            OR name LIKE 'uploads/' || (auth.uid())::text || '/%'
            OR (auth.uid() = owner)
          )
        )
        WITH CHECK (
          bucket_id = 'public_assets'
          AND (
            name LIKE 'avatars/' || (auth.uid())::text || '/%'
            OR name LIKE 'uploads/' || (auth.uid())::text || '/%'
            OR (auth.uid() = owner)
          )
        );
    END IF;

    -- Ensure users can only delete objects in their own folder
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_assets_delete'
    ) THEN
      CREATE POLICY public_assets_delete ON storage.objects
        FOR DELETE USING (
          bucket_id = 'public_assets'
          AND (
            name LIKE 'avatars/' || (auth.uid())::text || '/%'
            OR name LIKE 'uploads/' || (auth.uid())::text || '/%'
            OR (auth.uid() = owner)
          )
        );
    END IF;
  END IF;
END $$;
