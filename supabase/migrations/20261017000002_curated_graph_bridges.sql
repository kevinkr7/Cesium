-- ============================================================================
-- CESIUM DATABASE MIGRATION: 20261017000002_curated_graph_bridges.sql
-- Additive Cross-Disciplinary Graph Relations & Discovery Bridges
-- ============================================================================

WITH i AS (
  SELECT id, slug FROM public.interests
)
INSERT INTO public.interest_relations (interest_a, interest_b, relation_type, weight)
SELECT 
  i1.id, i2.id, r.rel_type, r.w
FROM (
  VALUES
    ('creative-coding', 'astronomy', 'cross-domain', 0.75::numeric(3,2)),
    ('film-photography', 'indie-cinema', 'cross-domain', 0.85::numeric(3,2)),
    ('film-photography', 'typography', 'related', 0.75::numeric(3,2)),
    ('ambient-music', 'film-photography', 'cross-domain', 0.75::numeric(3,2)),
    ('brutalist-architecture', 'abandoned-railways', 'cross-domain', 0.80::numeric(3,2))
) AS r(slug_a, slug_b, rel_type, w)
JOIN i i1 ON i1.slug = r.slug_a
JOIN i i2 ON i2.slug = r.slug_b
ON CONFLICT (interest_a, interest_b) DO UPDATE SET
  relation_type = EXCLUDED.relation_type,
  weight = EXCLUDED.weight;
