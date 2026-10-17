-- ============================================================================
-- CESIUM DATABASE MIGRATION: 20261017000003_uncommon_ground_rpc.sql
-- Enhanced Uncommon Ground Discovery RPC with Contextual Narrative Generation
-- ============================================================================

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
      count(DISTINCT i.category) FILTER (WHERE ci.interest_id IS NOT NULL)::float AS shared_categories_count,
      array_agg(i.name) FILTER (WHERE ci.interest_id IS NULL) AS unshared_names
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
      ROUND(
        LEAST(100.0, GREATEST(0.0,
          (
            CASE 
              WHEN (COALESCE((SELECT c FROM caller_count), 0) + COALESCE(ci.total_count, 0) - COALESCE(ci.shared_count, 0)) > 0
              THEN (COALESCE(ci.shared_count, 0) / (COALESCE((SELECT c FROM caller_count), 0) + COALESCE(ci.total_count, 0) - COALESCE(ci.shared_count, 0))) * 60.0
              ELSE 0.0
            END
            + (COALESCE(ci.shared_primary_count, 0) * 12.0)
            + (COALESCE(ci.shared_categories_count, 0) * 6.0)
          )
        ))::numeric, 2
      ) AS match_score,
      CASE
        WHEN p_filter = 'Uncommon connections' THEN
          CASE
            WHEN COALESCE(ci.shared_count, 0) = 1 AND array_length(ci.unshared_names, 1) > 0 THEN
              'You both connect over ' || (ci.shared_names)[1] || ', but their interest in ' || (ci.unshared_names)[1] || ' opens an entirely different orbit.'
            WHEN COALESCE(ci.shared_count, 0) = 1 THEN
              'You both have an affinity for ' || (ci.shared_names)[1] || '.'
            ELSE
              'An uncommon overlap of disparate perspectives and shared curiosity.'
          END
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
