-- ============================================================================
-- CESIUM MIGRATION 20261022000001: Visual Media Feed, RLS & Visibility Controls
-- ============================================================================
-- Additive idempotent migration defining public and connections-only visual
-- posts (photos & videos), likes, comments, triggers, and robust RLS policies.

-- 1. Create visibility enum if it does not already exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_visibility') THEN
    CREATE TYPE public.post_visibility AS ENUM ('public', 'connections_only');
  END IF;
END $$;

-- 2. Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  thumbnail_url TEXT,
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 1000),
  visibility public.post_visibility NOT NULL DEFAULT 'public',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create post_likes table
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- 4. Create post_comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON public.post_comments(post_id, created_at ASC);

-- 6. Helper function to check if two users are accepted connections
CREATE OR REPLACE FUNCTION public.are_users_connected(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections
    WHERE status = 'accepted'
    AND (
      (requester_id = p_user_a AND addressee_id = p_user_b)
      OR (addressee_id = p_user_a AND requester_id = p_user_b)
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7. Helper function to check if users have a mutual block
CREATE OR REPLACE FUNCTION public.is_user_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
       OR (blocker_id = p_user_b AND blocked_id = p_user_a)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 9. Strict RLS Policies for posts
DO $$ BEGIN
  DROP POLICY IF EXISTS posts_select ON public.posts;
  CREATE POLICY posts_select ON public.posts
    FOR SELECT TO authenticated, anon
    USING (
      (
        user_id = auth.uid()
        OR visibility = 'public'
        OR (
          visibility = 'connections_only'
          AND auth.uid() IS NOT NULL
          AND public.are_users_connected(auth.uid(), user_id)
        )
      )
      AND (auth.uid() IS NULL OR NOT public.is_user_blocked(auth.uid(), user_id))
    );

  DROP POLICY IF EXISTS posts_insert ON public.posts;
  CREATE POLICY posts_insert ON public.posts
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS posts_update ON public.posts;
  CREATE POLICY posts_update ON public.posts
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS posts_delete ON public.posts;
  CREATE POLICY posts_delete ON public.posts
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- 10. Strict RLS Policies for post_likes
DO $$ BEGIN
  DROP POLICY IF EXISTS post_likes_select ON public.post_likes;
  CREATE POLICY post_likes_select ON public.post_likes
    FOR SELECT TO authenticated, anon
    USING (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_likes.post_id
      )
    );

  DROP POLICY IF EXISTS post_likes_insert ON public.post_likes;
  CREATE POLICY post_likes_insert ON public.post_likes
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS post_likes_delete ON public.post_likes;
  CREATE POLICY post_likes_delete ON public.post_likes
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- 11. Strict RLS Policies for post_comments
DO $$ BEGIN
  DROP POLICY IF EXISTS post_comments_select ON public.post_comments;
  CREATE POLICY post_comments_select ON public.post_comments
    FOR SELECT TO authenticated, anon
    USING (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_comments.post_id
      )
    );

  DROP POLICY IF EXISTS post_comments_insert ON public.post_comments;
  CREATE POLICY post_comments_insert ON public.post_comments
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_comments.post_id
      )
    );

  DROP POLICY IF EXISTS post_comments_delete ON public.post_comments;
  CREATE POLICY post_comments_delete ON public.post_comments
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- 12. Automated Triggers to sync like and comment counters
CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_post_likes ON public.post_likes;
CREATE TRIGGER trg_sync_post_likes
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

CREATE OR REPLACE FUNCTION public.sync_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comments_count = GREATEST(comments_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_post_comments ON public.post_comments;
CREATE TRIGGER trg_sync_post_comments
AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_post_comments_count();

-- 13. Enable Supabase Realtime replication on posts
ALTER TABLE public.posts REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
