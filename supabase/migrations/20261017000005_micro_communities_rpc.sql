-- ============================================================================
-- CESIUM — MIGRATION 20261017000005: MICRO-COMMUNITIES & THREADS RPC
-- Atomic community creation, membership, discussion posts & replies
-- ============================================================================

-- 1. Transactional RPC: Create Micro-Community with Owner Role & Tagged Topics
CREATE OR REPLACE FUNCTION public.rpc_create_community(
  p_name TEXT,
  p_description TEXT,
  p_topics TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_slug TEXT;
  v_comm_id TEXT;
  v_topic TEXT;
  v_interest_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF char_length(trim(p_name)) < 3 OR char_length(p_name) > 40 THEN
    RAISE EXCEPTION 'Community name must be between 3 and 40 characters';
  END IF;

  IF char_length(trim(p_description)) < 10 OR char_length(p_description) > 500 THEN
    RAISE EXCEPTION 'Community description must be between 10 and 500 characters';
  END IF;

  -- Generate deterministic slug
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
  v_comm_id := v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  -- Insert community
  INSERT INTO public.communities (id, slug, name, line, description, creator_id, visibility, created_at, updated_at)
  VALUES (
    v_comm_id,
    v_slug,
    trim(p_name),
    substr(trim(p_description), 1, 70),
    trim(p_description),
    v_caller,
    'public',
    now(),
    now()
  );

  -- Creator is automatically owner member
  INSERT INTO public.community_members (community_id, user_id, role, joined_at)
  VALUES (v_comm_id, v_caller, 'owner', now());

  -- Attach topic interests if present in interest catalog
  IF p_topics IS NOT NULL THEN
    FOREACH v_topic IN ARRAY p_topics LOOP
      SELECT id INTO v_interest_id FROM public.interests WHERE lower(name) = lower(trim(v_topic)) LIMIT 1;
      IF v_interest_id IS NOT NULL THEN
        INSERT INTO public.community_interests (community_id, interest_id)
        VALUES (v_comm_id, v_interest_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'community_id', v_comm_id,
    'slug', v_slug,
    'name', trim(p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Transactional RPC: Create Discussion Post with Member Verification
CREATE OR REPLACE FUNCTION public.rpc_create_community_post(
  p_community_id TEXT,
  p_title TEXT,
  p_content TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_post_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF char_length(trim(p_title)) < 3 OR char_length(p_title) > 200 THEN
    RAISE EXCEPTION 'Thread title must be between 3 and 200 characters';
  END IF;

  IF char_length(p_content) > 5000 THEN
    RAISE EXCEPTION 'Thread content cannot exceed 5000 characters';
  END IF;

  -- Ensure caller is a joined member of the community
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Must be a community member to create a discussion thread';
  END IF;

  INSERT INTO public.community_posts (community_id, author_id, title, content, created_at, updated_at)
  VALUES (p_community_id, v_caller, trim(p_title), trim(p_content), now(), now())
  RETURNING id INTO v_post_id;

  RETURN jsonb_build_object('success', true, 'post_id', v_post_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Transactional RPC: Create Reply to Discussion Post
CREATE OR REPLACE FUNCTION public.rpc_create_community_reply(
  p_post_id UUID,
  p_text TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_reply_id UUID;
  v_comm_id TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF char_length(trim(p_text)) < 1 OR char_length(p_text) > 3000 THEN
    RAISE EXCEPTION 'Reply text must be between 1 and 3000 characters';
  END IF;

  -- Verify post exists
  SELECT community_id INTO v_comm_id FROM public.community_posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discussion thread not found';
  END IF;

  -- Verify caller is a member of the community
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = v_comm_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Must be a community member to reply to a thread';
  END IF;

  INSERT INTO public.community_replies (post_id, author_id, text, created_at)
  VALUES (p_post_id, v_caller, trim(p_text), now())
  RETURNING id INTO v_reply_id;

  -- Update post timestamp
  UPDATE public.community_posts SET updated_at = now() WHERE id = p_post_id;

  RETURN jsonb_build_object('success', true, 'reply_id', v_reply_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Transactional RPC: Delete Post (Author or Community Owner/Moderator)
CREATE OR REPLACE FUNCTION public.rpc_delete_community_post(p_post_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_post RECORD;
  v_is_moderator BOOLEAN;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_post FROM public.community_posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discussion thread not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = v_post.community_id AND user_id = v_caller AND role IN ('owner', 'moderator')
  ) INTO v_is_moderator;

  IF v_post.author_id <> v_caller AND NOT v_is_moderator THEN
    RAISE EXCEPTION 'Only author or community moderators can delete this thread';
  END IF;

  DELETE FROM public.community_posts WHERE id = p_post_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
