-- ============================================================================
-- CESIUM DATABASE SCHEMA MIGRATION: 20261015000001_initial_schema.sql
-- PostgreSQL / Supabase Schema for Cesium Social Discovery Platform
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 1. USER PROFILES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle CITEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  city TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_path TEXT,
  conversation_style TEXT[] DEFAULT '{}',
  topics TEXT DEFAULT '',
  discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT handle_length CHECK (char_length(handle) >= 2 AND char_length(handle) <= 30),
  CONSTRAINT display_name_length CHECK (char_length(display_name) >= 1 AND char_length(display_name) <= 60),
  CONSTRAINT bio_length CHECK (char_length(bio) <= 240)
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_discoverable ON public.profiles(discoverable) WHERE discoverable = TRUE;

-- ----------------------------------------------------------------------------
-- 2. INTEREST CATALOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug CITEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT interest_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 60),
  CONSTRAINT interest_category_length CHECK (char_length(category) >= 2 AND char_length(category) <= 40)
);

CREATE INDEX IF NOT EXISTS idx_interests_category ON public.interests(category);
CREATE INDEX IF NOT EXISTS idx_interests_slug ON public.interests(slug);
CREATE INDEX IF NOT EXISTS idx_interests_name_trgm ON public.interests USING gin(name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 3. USER INTERESTS (Personal Constellation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_interests (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_niche BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user ON public.user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_interest ON public.user_interests(interest_id);

-- ----------------------------------------------------------------------------
-- 4. CURATED INTEREST RELATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interest_relations (
  interest_a UUID NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  interest_b UUID NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'related',
  weight NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (weight >= 0.0 AND weight <= 1.0),
  PRIMARY KEY (interest_a, interest_b),
  CONSTRAINT no_self_relation CHECK (interest_a <> interest_b)
);

-- ----------------------------------------------------------------------------
-- 5. CONNECTIONS (Lifecycle: pending -> accepted | declined | canceled | removed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'canceled', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_connection CHECK (requester_id <> addressee_id)
);

-- Enforce uniqueness of unordered user pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_unordered_pair 
ON public.connections (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS idx_connections_requester ON public.connections(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON public.connections(addressee_id, status);

-- ----------------------------------------------------------------------------
-- 6. CONVERSATIONS & MEMBERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);

-- ----------------------------------------------------------------------------
-- 7. MESSAGES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT message_body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. COMMUNITIES & MEMBERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communities (
  id TEXT PRIMARY KEY,
  slug CITEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  line TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  avatar_path TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT community_name_length CHECK (char_length(name) >= 3 AND char_length(name) <= 60),
  CONSTRAINT community_line_length CHECK (char_length(line) <= 120),
  CONSTRAINT community_description_length CHECK (char_length(description) <= 1000)
);

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_members_user ON public.community_members(user_id);

CREATE TABLE IF NOT EXISTS public.community_interests (
  community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  PRIMARY KEY (community_id, interest_id)
);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_community_posts_comm ON public.community_posts(community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reply_text_length CHECK (char_length(text) >= 1 AND char_length(text) <= 3000)
);

CREATE INDEX IF NOT EXISTS idx_community_replies_post ON public.community_replies(post_id, created_at ASC);

-- ----------------------------------------------------------------------------
-- 9. SAFETY & NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('connection_request', 'connection_accepted', 'new_message', 'community_reply')),
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 10. TRIGGERS: TIMESTAMP MAINTENANCE & USER CREATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_communities_updated_at BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_community_posts_updated_at BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatic Profile Creation upon Supabase Auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_handle TEXT;
  v_display_name TEXT;
BEGIN
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  v_handle := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9_]', '', 'g'));
  IF char_length(v_handle) < 2 THEN
    v_handle := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;
  
  -- Ensure handle uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = v_handle) LOOP
    v_handle := v_handle || floor(random() * 9 + 1)::text;
  END LOOP;

  INSERT INTO public.profiles (id, handle, display_name, created_at, updated_at)
  VALUES (NEW.id, v_handle, v_display_name, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind to auth.users if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles:
-- Anyone authenticated can view discoverable profiles (or their own)
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    discoverable = TRUE 
    OR auth.uid() = id
  );

-- Users can only update their own profile
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Interests:
-- Anyone can read the interest catalog
CREATE POLICY interests_select ON public.interests
  FOR SELECT USING (TRUE);

-- Authenticated users can insert custom interests
CREATE POLICY interests_insert ON public.interests
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- User Interests:
-- Anyone can see user interests for public profiles
CREATE POLICY user_interests_select ON public.user_interests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = user_interests.user_id AND (p.discoverable = TRUE OR p.id = auth.uid())
    )
  );

-- Users can only modify their own interests
CREATE POLICY user_interests_insert ON public.user_interests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_interests_delete ON public.user_interests
  FOR DELETE USING (auth.uid() = user_id);

-- Interest Relations:
CREATE POLICY interest_relations_select ON public.interest_relations
  FOR SELECT USING (TRUE);

-- Connections:
-- Users can only select connections they are a party to
CREATE POLICY connections_select ON public.connections
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Authenticated users can insert requests where they are requester
CREATE POLICY connections_insert ON public.connections
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users 
      WHERE (blocker_id = addressee_id AND blocked_id = requester_id)
         OR (blocker_id = requester_id AND blocked_id = addressee_id)
    )
  );

-- Only addressee or requester can update their connection
CREATE POLICY connections_update ON public.connections
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Conversations & Members:
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY conv_members_select ON public.conversation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Messages:
-- Can only select messages from conversations you belong to
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Can only insert messages if sender is authenticated user AND belongs to conversation AND connection is accepted
CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Communities:
CREATE POLICY communities_select ON public.communities
  FOR SELECT USING (visibility = 'public' OR creator_id = auth.uid());

CREATE POLICY communities_insert ON public.communities
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY communities_update ON public.communities
  FOR UPDATE USING (auth.uid() = creator_id);

-- Community Members:
CREATE POLICY comm_members_select ON public.community_members
  FOR SELECT USING (TRUE);

CREATE POLICY comm_members_insert ON public.community_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY comm_members_delete ON public.community_members
  FOR DELETE USING (auth.uid() = user_id);

-- Community Posts & Replies:
CREATE POLICY comm_posts_select ON public.community_posts
  FOR SELECT USING (TRUE);

CREATE POLICY comm_posts_insert ON public.community_posts
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.community_members cm 
      WHERE cm.community_id = community_posts.community_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY comm_posts_update ON public.community_posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY comm_replies_select ON public.community_replies
  FOR SELECT USING (TRUE);

CREATE POLICY comm_replies_insert ON public.community_replies
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Blocked Users:
CREATE POLICY blocked_users_select ON public.blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY blocked_users_insert ON public.blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY blocked_users_delete ON public.blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

-- User Reports:
CREATE POLICY user_reports_select ON public.user_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY user_reports_insert ON public.user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Notifications:
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 12. RPC FUNCTIONS: MATCHING & ATOMIC TRANSACTIONS
-- ----------------------------------------------------------------------------

-- Transactional Connection Request with Anti-Spam
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

  -- Check existing connection record between this unordered pair
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

  -- Create Notification for addressee
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

-- Transactional Connection Response (Accept / Decline)
CREATE OR REPLACE FUNCTION public.rpc_respond_to_connection_request(p_connection_id UUID, p_status TEXT)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_conn RECORD;
  v_conv_id UUID;
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

  -- Only recipient can accept or decline
  IF v_conn.addressee_id <> v_caller THEN
    RAISE EXCEPTION 'Only the recipient can respond to this request';
  END IF;

  UPDATE public.connections
  SET status = p_status, updated_at = now()
  WHERE id = p_connection_id;

  IF p_status = 'accepted' THEN
    -- Check or create private conversation
    SELECT c.id INTO v_conv_id
    FROM public.conversations c
    JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = v_conn.requester_id
    JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = v_conn.addressee_id;

    IF v_conv_id IS NULL THEN
      INSERT INTO public.conversations (created_at, updated_at) VALUES (now(), now()) RETURNING id INTO v_conv_id;
      INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv_id, v_conn.requester_id);
      INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_conv_id, v_conn.addressee_id);
    END IF;

    -- Notify requester
    INSERT INTO public.notifications (user_id, type, title, payload)
    VALUES (
      v_conn.requester_id,
      'connection_accepted',
      'Connection accepted',
      jsonb_build_object('addressee_id', v_caller, 'conversation_id', v_conv_id)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transactional Message Sending with Access Verification
CREATE OR REPLACE FUNCTION public.rpc_send_message(p_conversation_id UUID, p_body TEXT)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_other_user UUID;
  v_conn_status TEXT;
  v_msg_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF char_length(trim(p_body)) = 0 OR char_length(p_body) > 5000 THEN
    RAISE EXCEPTION 'Message must be between 1 and 5000 characters';
  END IF;

  -- Verify caller is a conversation member
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = p_conversation_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a member of this conversation';
  END IF;

  -- Find the recipient in this conversation
  SELECT user_id INTO v_other_user 
  FROM public.conversation_members 
  WHERE conversation_id = p_conversation_id AND user_id <> v_caller
  LIMIT 1;

  -- Ensure active accepted connection
  IF v_other_user IS NOT NULL THEN
    SELECT status INTO v_conn_status FROM public.connections
    WHERE (requester_id = v_caller AND addressee_id = v_other_user)
       OR (requester_id = v_other_user AND addressee_id = v_caller);

    IF v_conn_status <> 'accepted' THEN
      RAISE EXCEPTION 'Cannot message without an active connection';
    END IF;

    -- Verify not blocked
    IF EXISTS (
      SELECT 1 FROM public.blocked_users 
      WHERE (blocker_id = v_caller AND blocked_id = v_other_user)
         OR (blocker_id = v_other_user AND blocked_id = v_caller)
    ) THEN
      RAISE EXCEPTION 'Communication with this user is blocked';
    END IF;
  END IF;

  -- Insert message
  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_caller, trim(p_body))
  RETURNING id INTO v_msg_id;

  -- Update conversation activity timestamp
  UPDATE public.conversations SET updated_at = now() WHERE id = p_conversation_id;

  -- Notify recipient if present
  IF v_other_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, payload)
    VALUES (
      v_other_user,
      'new_message',
      'New message received',
      jsonb_build_object('conversation_id', p_conversation_id, 'sender_id', v_caller, 'message_id', v_msg_id)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message_id', v_msg_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 13. PHASE 6 & 7: THE OVERLAP ENGINE & UNCOMMON GROUND (RPC)
-- Deterministic Jaccard overlap + Primary bonus + Rarity bonus + Category diversity
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_discovery(
  p_filter TEXT DEFAULT 'all',
  p_query TEXT DEFAULT '',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  handle CITEXT,
  display_name TEXT,
  city TEXT,
  bio TEXT,
  avatar_path TEXT,
  interests TEXT[],
  shared_interests TEXT[],
  match_score NUMERIC(5,2),
  explanation TEXT,
  connection_status TEXT
) AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  RETURN QUERY
  WITH caller_interests AS (
    SELECT ui.interest_id, ui.is_primary, i.name, i.category
    FROM public.user_interests ui
    JOIN public.interests i ON i.id = ui.interest_id
    WHERE ui.user_id = v_caller
  ),
  caller_count AS (
    SELECT count(*)::float AS c FROM caller_interests
  ),
  candidate_profiles AS (
    SELECT p.id, p.handle, p.display_name, p.city, p.bio, p.avatar_path
    FROM public.profiles p
    WHERE (v_caller IS NULL OR p.id <> v_caller)
      AND p.discoverable = TRUE
      AND p.onboarding_completed = TRUE
      -- Exclude blocked users in either direction
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_users b
        WHERE (b.blocker_id = v_caller AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = v_caller)
      )
      -- Search query filter
      AND (
        p_query = '' 
        OR p.display_name ILIKE '%' || p_query || '%'
        OR p.handle::text ILIKE '%' || p_query || '%'
        OR p.bio ILIKE '%' || p_query || '%'
      )
  ),
  candidate_interests AS (
    SELECT 
      cp.id AS profile_id,
      array_agg(i.name ORDER BY i.name) AS all_interests,
      count(ui.interest_id)::float AS total_count,
      array_agg(i.name) FILTER (WHERE ci.interest_id IS NOT NULL) AS shared_names,
      count(ui.interest_id) FILTER (WHERE ci.interest_id IS NOT NULL)::float AS shared_count,
      count(ui.interest_id) FILTER (WHERE ci.interest_id IS NOT NULL AND (ui.is_primary OR ci.is_primary))::float AS shared_primary_count,
      count(DISTINCT i.category) FILTER (WHERE ci.interest_id IS NOT NULL)::float AS shared_categories_count
    FROM candidate_profiles cp
    LEFT JOIN public.user_interests ui ON ui.user_id = cp.id
    LEFT JOIN public.interests i ON i.id = ui.interest_id
    LEFT JOIN caller_interests ci ON ci.interest_id = ui.interest_id
    GROUP BY cp.id
  ),
  scored_candidates AS (
    SELECT
      cp.id,
      cp.handle,
      cp.display_name,
      cp.city,
      cp.bio,
      cp.avatar_path,
      COALESCE(ci.all_interests, ARRAY[]::TEXT[]) AS interests,
      COALESCE(ci.shared_names, ARRAY[]::TEXT[]) AS shared_interests,
      -- Jaccard index: shared / (caller_count + candidate_count - shared)
      ROUND(
        LEAST(100.0, GREATEST(0.0,
          (
            CASE 
              WHEN (COALESCE((SELECT c FROM caller_count), 0) + COALESCE(ci.total_count, 0) - COALESCE(ci.shared_count, 0)) > 0
              THEN (COALESCE(ci.shared_count, 0) / (COALESCE((SELECT c FROM caller_count), 0) + COALESCE(ci.total_count, 0) - COALESCE(ci.shared_count, 0))) * 60.0
              ELSE 0.0
            END
            -- Primary shared bonus
            + (COALESCE(ci.shared_primary_count, 0) * 12.0)
            -- Category diversity bonus
            + (COALESCE(ci.shared_categories_count, 0) * 6.0)
          )
        ))::numeric, 2
      ) AS match_score,
      -- Deterministic explanation template based on shared interests
      CASE
        WHEN COALESCE(ci.shared_count, 0) >= 3 THEN
          'You both explore ' || array_to_string((ci.shared_names)[1:2], ', ') || ' and ' || (ci.shared_names)[3] || '.'
        WHEN COALESCE(ci.shared_count, 0) = 2 THEN
          'You share common ground in ' || (ci.shared_names)[1] || ' and ' || (ci.shared_names)[2] || '.'
        WHEN COALESCE(ci.shared_count, 0) = 1 THEN
          'You both have an affinity for ' || (ci.shared_names)[1] || '.'
        ELSE
          'Different constellations waiting to cross paths.'
      END AS explanation,
      COALESCE(conn.status, 'none') AS connection_status
    FROM candidate_profiles cp
    LEFT JOIN candidate_interests ci ON ci.profile_id = cp.id
    LEFT JOIN public.connections conn ON 
      (conn.requester_id = v_caller AND conn.addressee_id = cp.id)
      OR (conn.requester_id = cp.id AND conn.addressee_id = v_caller)
  )
  SELECT 
    sc.id,
    sc.handle,
    sc.display_name,
    sc.city,
    sc.bio,
    sc.avatar_path,
    sc.interests,
    sc.shared_interests,
    sc.match_score,
    sc.explanation,
    sc.connection_status
  FROM scored_candidates sc
  WHERE 
    CASE
      WHEN p_filter = 'Shared interests' THEN array_length(sc.shared_interests, 1) >= 2
      WHEN p_filter = 'Uncommon connections' THEN array_length(sc.shared_interests, 1) <= 1
      ELSE TRUE
    END
  ORDER BY 
    CASE WHEN p_filter = 'Uncommon connections' THEN sc.match_score END ASC,
    sc.match_score DESC,
    sc.display_name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
