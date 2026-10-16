-- ============================================================================
-- CESIUM DATABASE SEED MIGRATION: 20261015000002_seed_data.sql
-- Seed Data for Curated Interests, Categories, Communities, and Graph Relations
-- ============================================================================

-- 1. SEED CURATED INTERESTS
INSERT INTO public.interests (slug, name, category, description) VALUES
  -- Creative
  ('film-photography', 'Film photography', 'Creative', 'Shooting analog 35mm and medium format emulsions.'),
  ('zine-making', 'Zine making', 'Creative', 'Self-published, small-circulation booklets and personal archives.'),
  ('letterpress', 'Letterpress', 'Creative', 'Relief printing with movable metal or wooden types.'),
  ('ceramics', 'Ceramics', 'Creative', 'Hand-built clay vessels, wheel throwing, and experimental glazes.'),
  ('typography', 'Typography', 'Creative', 'Type design, font history, and street lettering.'),

  -- Technology
  ('creative-coding', 'Creative coding', 'Technology', 'Generative shaders, canvas experiments, and expressive algorithms.'),
  ('mechanical-keyboards', 'Mechanical keyboards', 'Technology', 'Custom switches, lubing, soldered PCBs, and keycap profiles.'),
  ('retro-computing', 'Retro computing', 'Technology', '8-bit microcomputers, CRT monitors, and vintage assembly.'),
  ('home-automation', 'Home automation', 'Technology', 'Local sensor networks, Home Assistant scripts, and ambient hardware.'),

  -- Music
  ('ambient-music', 'Ambient music', 'Music', 'Textural soundscapes, drone, tape loops, and generative calm.'),
  ('synthesizers', 'Synthesizers', 'Music', 'Modular Eurorack patching, analog oscillators, and subtractive synthesis.'),
  ('music-theory', 'Music theory', 'Music', 'Modal harmony, rhythm structures, microtonality, and tuning systems.'),
  ('field-recording', 'Field recording', 'Music', 'Binaural microphones capturing room tones, wind, and city acoustics.'),

  -- Science
  ('astronomy', 'Astronomy', 'Science', 'Deep space observations, nebulae tracking, and telescope optics.'),
  ('mycology', 'Mycology', 'Science', 'Mushroom foraging, fungal mycelium networks, and spore prints.'),
  ('linguistics', 'Linguistics', 'Science', 'Historical phonetics, grammar evolution, and translated syntax.'),
  ('deep-sea-biology', 'Deep sea biology', 'Science', 'Abyssal organisms, bioluminescence, and benthic hydrothermal vents.'),

  -- Culture
  ('indie-cinema', 'Indie cinema', 'Culture', 'Slow cinema, auteur directors, festival retrospectives, and 16mm prints.'),
  ('translated-fiction', 'Translated fiction', 'Culture', 'International literature bridging disparate linguistic worlds.'),
  ('brutalist-architecture', 'Brutalist architecture', 'Culture', 'Raw board-marked concrete, heroic scale, and architectural preservation.'),
  ('urban-walking', 'Urban walking', 'Culture', 'Psychogeography, flânerie, wandering back alleys, and city edges.'),

  -- Gaming
  ('indie-games', 'Indie games', 'Gaming', 'Experimental mechanics, evocative pixel art, and solo-dev gems.'),
  ('speedrunning', 'Speedrunning', 'Gaming', 'Frame-perfect route optimization, glitch exploitation, and muscle memory.'),
  ('tabletop-rpgs', 'Tabletop RPGs', 'Gaming', 'Collaborative storytelling, custom rulesets, and world-building.'),
  ('puzzle-design', 'Puzzle design', 'Gaming', 'Sokoban twists, recursive systems, and elegant aha moments.'),

  -- Unusual obsessions
  ('abandoned-railways', 'Abandoned railways', 'Unusual obsessions', 'Overgrown tracks, derelict stations, and lost industrial routes.'),
  ('fonts-on-old-signage', 'Fonts on old signage', 'Unusual obsessions', 'Hand-painted enamel signs, neon letterforms, and ghost signs.'),
  ('weather-maps', 'Weather maps', 'Unusual obsessions', 'Isobar lines, radar echoes, synoptic charts, and storm tracking.'),
  ('0143-am-ideas', '01:43 AM ideas', 'Unusual obsessions', 'Strange midnight inventions and notes written in half-sleep.')
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- 2. SEED CURATED INTEREST RELATIONS (Graph Edges for Constellation)
WITH i AS (
  SELECT id, slug FROM public.interests
)
INSERT INTO public.interest_relations (interest_a, interest_b, relation_type, weight)
SELECT 
  i1.id, i2.id, 'related', 0.85
FROM i i1, i i2
WHERE (
  (i1.slug = 'creative-coding' AND i2.slug = 'synthesizers') OR
  (i1.slug = 'creative-coding' AND i2.slug = 'indie-games') OR
  (i1.slug = 'film-photography' AND i2.slug = 'zine-making') OR
  (i1.slug = 'film-photography' AND i2.slug = 'brutalist-architecture') OR
  (i1.slug = 'ambient-music' AND i2.slug = 'field-recording') OR
  (i1.slug = 'ambient-music' AND i2.slug = 'synthesizers') OR
  (i1.slug = 'astronomy' AND i2.slug = 'weather-maps') OR
  (i1.slug = 'typography' AND i2.slug = 'letterpress') OR
  (i1.slug = 'typography' AND i2.slug = 'fonts-on-old-signage') OR
  (i1.slug = 'mycology' AND i2.slug = 'zine-making') OR
  (i1.slug = 'indie-cinema' AND i2.slug = 'translated-fiction') OR
  (i1.slug = 'speedrunning' AND i2.slug = 'puzzle-design') OR
  (i1.slug = 'abandoned-railways' AND i2.slug = 'urban-walking')
)
ON CONFLICT (interest_a, interest_b) DO NOTHING;

-- 3. SEED COMMUNITIES
INSERT INTO public.communities (id, slug, name, line, description, visibility) VALUES
  ('2am-builders', '2am-builders', 'The 2AM Builders', 'People who create when everyone else sleeps.', 'A slow, nocturnal room for side projects nobody asked for. Post what you made tonight, however small.', 'public'),
  ('sound-syntax', 'sound-syntax', 'Sound & Syntax', 'Coders with a music obsession.', 'Live coding, DSP rabbit holes, and sharing patches that sound like weather.', 'public'),
  ('orbit-club', 'orbit-club', 'Orbit Club', 'Astronomy, visual art, and impossible questions.', 'Look up together. Sketch what you see. Ask the question that seems too big.', 'public'),
  ('frame-by-frame', 'frame-by-frame', 'Frame by Frame', 'People who take films a little too seriously.', 'One film a week, discussed scene by scene. Spoilers expected, opinions defended.', 'public'),
  ('spore-society', 'spore-society', 'Spore Society', 'Fungi, print and quiet obsession.', 'Forage, identify, print. A small archive of things that grow in the dark.', 'public')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  line = EXCLUDED.line,
  description = EXCLUDED.description;

-- 4. LINK SEED COMMUNITY INTERESTS
INSERT INTO public.community_interests (community_id, interest_id)
SELECT '2am-builders', id FROM public.interests WHERE slug IN ('creative-coding', '0143-am-ideas')
ON CONFLICT DO NOTHING;

INSERT INTO public.community_interests (community_id, interest_id)
SELECT 'sound-syntax', id FROM public.interests WHERE slug IN ('synthesizers', 'creative-coding', 'music-theory')
ON CONFLICT DO NOTHING;

INSERT INTO public.community_interests (community_id, interest_id)
SELECT 'orbit-club', id FROM public.interests WHERE slug IN ('astronomy', 'weather-maps')
ON CONFLICT DO NOTHING;

INSERT INTO public.community_interests (community_id, interest_id)
SELECT 'frame-by-frame', id FROM public.interests WHERE slug IN ('indie-cinema', 'film-photography', 'translated-fiction')
ON CONFLICT DO NOTHING;

INSERT INTO public.community_interests (community_id, interest_id)
SELECT 'spore-society', id FROM public.interests WHERE slug IN ('mycology', 'zine-making', 'letterpress')
ON CONFLICT DO NOTHING;
