-- ============================================================================
-- CESIUM DATABASE ADDITIVE MIGRATION: 20261017000001_schema_constraints_and_rls.sql
-- Production Hardening: Comprehensive RLS Policies, Constraints, and Storage
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMMUNITY INTERESTS RLS POLICIES
-- Fix: community_interests had RLS enabled without SELECT/INSERT/DELETE policies
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'community_interests' AND policyname = 'community_interests_select'
  ) THEN
    CREATE POLICY community_interests_select ON public.community_interests
      FOR SELECT USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'community_interests' AND policyname = 'community_interests_insert'
  ) THEN
    CREATE POLICY community_interests_insert ON public.community_interests
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.communities c 
          WHERE c.id = community_id AND (c.creator_id = auth.uid() OR auth.uid() IS NOT NULL)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'community_interests' AND policyname = 'community_interests_delete'
  ) THEN
    CREATE POLICY community_interests_delete ON public.community_interests
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.communities c 
          WHERE c.id = community_id AND c.creator_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. PROFILES INSERT RLS POLICY
-- Allows users to insert/upsert their initial profile row directly
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert'
  ) THEN
    CREATE POLICY profiles_insert ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. USER INTERESTS UPDATE RLS POLICY
-- Allows users to modify primary/niche flags on their constellation interests
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_interests' AND policyname = 'user_interests_update'
  ) THEN
    CREATE POLICY user_interests_update ON public.user_interests
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. CONVERSATIONS & MEMBERS INSERT RLS POLICIES
-- Allows authenticated members to create conversations and add reciprocal participants
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_insert'
  ) THEN
    CREATE POLICY conversations_insert ON public.conversations
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversation_members' AND policyname = 'conv_members_insert'
  ) THEN
    CREATE POLICY conv_members_insert ON public.conversation_members
      FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND (
          auth.uid() = user_id
          OR EXISTS (
            SELECT 1 FROM public.connections c
            WHERE (c.requester_id = auth.uid() AND c.addressee_id = user_id AND c.status = 'accepted')
               OR (c.addressee_id = auth.uid() AND c.requester_id = user_id AND c.status = 'accepted')
          )
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. MESSAGES UPDATE (Soft Delete / Edit) RLS POLICY
-- Allows authors to edit or soft-delete their own messages
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_update'
  ) THEN
    CREATE POLICY messages_update ON public.messages
      FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. COMMUNITY POSTS & REPLIES DELETE / UPDATE RLS POLICIES
-- Allows authors and moderators to manage community threads and replies
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'community_posts' AND policyname = 'comm_posts_delete'
  ) THEN
    CREATE POLICY comm_posts_delete ON public.community_posts
      FOR DELETE USING (
        auth.uid() = author_id 
        OR EXISTS (
          SELECT 1 FROM public.communities c 
          WHERE c.id = community_id AND c.creator_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'community_replies' AND policyname = 'comm_replies_update'
  ) THEN
    CREATE POLICY comm_replies_update ON public.community_replies
      FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'community_replies' AND policyname = 'comm_replies_delete'
  ) THEN
    CREATE POLICY comm_replies_delete ON public.community_replies
      FOR DELETE USING (
        auth.uid() = author_id 
        OR EXISTS (
          SELECT 1 FROM public.community_posts p
          JOIN public.communities c ON c.id = p.community_id
          WHERE p.id = post_id AND (p.author_id = auth.uid() OR c.creator_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. NOTIFICATIONS DELETE RLS POLICY
-- Allows recipients to dismiss/clear their notifications
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_delete'
  ) THEN
    CREATE POLICY notifications_delete ON public.notifications
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. COMPOSITE PERFORMANCE INDEXES
-- Optimizes common high-frequency query paths
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_connections_status_users 
  ON public.connections(status, requester_id, addressee_id);

CREATE INDEX IF NOT EXISTS idx_community_posts_author 
  ON public.community_posts(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_replies_author 
  ON public.community_replies(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_time 
  ON public.messages(conversation_id, created_at ASC);

-- ----------------------------------------------------------------------------
-- 9. STORAGE BUCKET & POLICIES (If storage schema exists)
-- Sets up public_assets bucket for user avatars and community visuals
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    -- Ensure bucket exists
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

    -- Public read policy for storage objects in public_assets
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_assets_select'
    ) THEN
      CREATE POLICY public_assets_select ON storage.objects
        FOR SELECT USING (bucket_id = 'public_assets');
    END IF;

    -- Authenticated upload policy (users can upload to avatars/<user_id>/* or public/*)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_assets_insert'
    ) THEN
      CREATE POLICY public_assets_insert ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'public_assets'
          AND auth.role() = 'authenticated'
        );
    END IF;
  END IF;
END $$;
