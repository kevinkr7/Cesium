import { getSupabase } from "@/lib/supabase/client";
import { interestCategories } from "@/lib/data";

export type Interest = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string | null | undefined;
};

export type GraphNode = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string | null | undefined;
};

export type GraphEdge = {
  source: string;
  target: string;
  weight: number;
  relationType: string;
  explanation?: string | undefined;
};

export type ConstellationGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export const CURATED_GRAPH_EDGES: [string, string, number, string, string][] = [
  [
    "creative-coding",
    "synthesizers",
    0.85,
    "related",
    "Signal and code share a language: oscillators, loops, feedback.",
  ],
  [
    "creative-coding",
    "indie-games",
    0.85,
    "related",
    "Generative algorithms and game systems build on common creative foundations.",
  ],
  [
    "creative-coding",
    "astronomy",
    0.75,
    "cross-domain",
    "Both reward patient, systematic wonder — people often simulate the sky they observe.",
  ],
  [
    "film-photography",
    "zine-making",
    0.85,
    "related",
    "Photographic archives naturally find homes in tactile, self-published print.",
  ],
  [
    "film-photography",
    "brutalist-architecture",
    0.8,
    "related",
    "Raw textures, light, and architectural geometry captured on physical emulsion.",
  ],
  [
    "film-photography",
    "indie-cinema",
    0.85,
    "cross-domain",
    "A shared obsession with grain, light and slowness.",
  ],
  [
    "film-photography",
    "typography",
    0.75,
    "related",
    "Both are crafts of careful framing and deliberate composition.",
  ],
  [
    "ambient-music",
    "field-recording",
    0.9,
    "related",
    "Environmental room tones, wind, and textures form the bed of modern ambient sound.",
  ],
  [
    "ambient-music",
    "synthesizers",
    0.9,
    "related",
    "Most ambient records are built on the same patch cables and drone oscillators.",
  ],
  [
    "ambient-music",
    "film-photography",
    0.75,
    "cross-domain",
    "Mood-first art forms; people here trade playlists for photo walks.",
  ],
  [
    "astronomy",
    "weather-maps",
    0.85,
    "related",
    "Looking up at nebulae, then mapping atmospheric fronts and pressure lines.",
  ],
  [
    "typography",
    "letterpress",
    0.9,
    "related",
    "Relief printing with movable metal and wood type breathes life into letterforms.",
  ],
  [
    "typography",
    "fonts-on-old-signage",
    0.85,
    "related",
    "Hand-painted enamel lettering and historical ghost signs.",
  ],
  [
    "mycology",
    "zine-making",
    0.8,
    "related",
    "Spore prints and fungal foraging notebooks compiled into hand-stitched booklets.",
  ],
  [
    "indie-cinema",
    "translated-fiction",
    0.85,
    "related",
    "International literature and slow cinema exploring unseen psychological landscapes.",
  ],
  [
    "speedrunning",
    "puzzle-design",
    0.85,
    "related",
    "Understanding the underlying state machine down to the clock cycle.",
  ],
  [
    "abandoned-railways",
    "urban-walking",
    0.85,
    "related",
    "Psychogeography and flânerie along overgrown, forgotten transit corridors.",
  ],
  [
    "brutalist-architecture",
    "abandoned-railways",
    0.8,
    "cross-domain",
    "A shared eye for monolithic concrete, overgrown tracks, and fading industrial geometry.",
  ],
];

async function withTimeout<T>(promise: PromiseLike<T>, ms = 1500): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function fetchInterestCatalog(): Promise<Interest[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const res = await withTimeout(
        sb.from("interests").select("id, slug, name, category, description").order("name"),
        1500,
      );

      if (res && !res.error && res.data && res.data.length > 0) {
        return res.data;
      }
    } catch {
      // Graceful fallback to static catalog
    }
  }

  // Fallback to static catalog from categories
  const catalog: Interest[] = [];
  for (const [category, names] of Object.entries(interestCategories)) {
    for (const name of names) {
      const slug =
        name === "01:43 AM ideas"
          ? "0143-am-ideas"
          : name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
      catalog.push({
        id: slug,
        slug,
        name,
        category,
        description: `${category} interest: ${name}`,
      });
    }
  }
  return catalog;
}

export async function fetchAllInterests(): Promise<Record<string, string[]>> {
  const sb = getSupabase();
  if (!sb) {
    return interestCategories;
  }

  try {
    const res = await withTimeout(
      sb.from("interests").select("name, category").order("name"),
      1500,
    );
    if (!res || res.error || !res.data || res.data.length === 0) {
      return interestCategories;
    }

    const grouped: Record<string, string[]> = {};
    for (const item of res.data) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category]!.push(item.name);
    }
    return grouped;
  } catch {
    return interestCategories;
  }
}

export async function fetchConstellationGraph(): Promise<ConstellationGraph> {
  const catalog = await fetchInterestCatalog();
  const nodeMap = new Map<string, GraphNode>();
  for (const item of catalog) {
    nodeMap.set(item.slug, {
      id: item.slug,
      slug: item.slug,
      name: item.name,
      category: item.category,
      description: item.description,
    });
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const res = await withTimeout(
        sb.from("interest_relations").select("interest_a, interest_b, weight, relation_type"),
        1500,
      );

      if (res && !res.error && res.data && res.data.length > 0) {
        // Map UUIDs back to slugs if catalog has UUIDs
        const idToSlug = new Map<string, string>();
        for (const item of catalog) {
          idToSlug.set(item.id, item.slug);
        }

        const edges: GraphEdge[] = [];
        for (const edge of res.data) {
          const sourceSlug = idToSlug.get(edge.interest_a) ?? edge.interest_a;
          const targetSlug = idToSlug.get(edge.interest_b) ?? edge.interest_b;
          if (nodeMap.has(sourceSlug) && nodeMap.has(targetSlug)) {
            edges.push({
              source: sourceSlug,
              target: targetSlug,
              weight: Number(edge.weight),
              relationType: edge.relation_type,
            });
          }
        }

        if (edges.length > 0) {
          return {
            nodes: Array.from(nodeMap.values()),
            edges,
          };
        }
      }
    } catch {
      // Graceful fallback to static edges
    }
  }

  // Curated graph edges fallback
  const edges: GraphEdge[] = CURATED_GRAPH_EDGES.map(
    ([source, target, weight, relationType, explanation]) => ({
      source,
      target,
      weight,
      relationType,
      explanation,
    }),
  );

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

export async function saveUserInterests(
  userId: string,
  standardInterests: string[],
  nicheInterests: string[],
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb || userId === "demo" || userId.startsWith("test-")) return { success: true, error: null };

  // Clear existing
  const { error: delError } = await sb.from("user_interests").delete().eq("user_id", userId);
  if (delError) return { success: false, error: delError.message };

  const allNames = [
    ...standardInterests.map((n) => ({ name: n, isNiche: false })),
    ...nicheInterests.map((n) => ({ name: n, isNiche: true })),
  ];

  if (allNames.length === 0) return { success: true, error: null };

  for (const item of allNames) {
    const slug = item.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check or insert interest
    let { data: interest } = await sb.from("interests").select("id").eq("slug", slug).maybeSingle();
    if (!interest) {
      const { data: newInterest, error: insertError } = await sb
        .from("interests")
        .insert({
          slug,
          name: item.name.trim(),
          category: item.isNiche ? "Unusual obsessions" : "Curated",
          created_by: userId,
        })
        .select("id")
        .single();

      if (!insertError && newInterest) interest = newInterest;
    }

    if (interest) {
      await sb.from("user_interests").insert({
        user_id: userId,
        interest_id: interest.id,
        is_primary: !item.isNiche,
        is_niche: item.isNiche,
      });
    }
  }

  return { success: true, error: null };
}

export async function fetchUserInterests(
  userId: string,
): Promise<{ standard: string[]; niche: string[] }> {
  const sb = getSupabase();
  if (!sb) return { standard: [], niche: [] };

  const { data, error } = await sb
    .from("user_interests")
    .select("is_niche, interests(name)")
    .eq("user_id", userId);

  if (error || !data) return { standard: [], niche: [] };

  const standard: string[] = [];
  const niche: string[] = [];

  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (row.interests as any)?.name;
    if (!name) continue;
    if (row.is_niche) niche.push(name);
    else standard.push(name);
  }

  return { standard, niche };
}

export type RelatedInterest = {
  slug: string;
  weight: number;
  relationType: string;
  explanation?: string | undefined;
};

export async function fetchRelatedInterests(slug: string): Promise<RelatedInterest[]> {
  const graph = await fetchConstellationGraph();
  const related: RelatedInterest[] = [];

  for (const edge of graph.edges) {
    if (edge.source === slug) {
      related.push({
        slug: edge.target,
        weight: edge.weight,
        relationType: edge.relationType,
        explanation: edge.explanation,
      });
    } else if (edge.target === slug) {
      // Symmetric / bidirectional traversal
      related.push({
        slug: edge.source,
        weight: edge.weight,
        relationType: edge.relationType,
        explanation: edge.explanation,
      });
    }
  }

  return related;
}

export function validateMinCuratedInterests(standardInterests: string[]): {
  valid: boolean;
  error: string | null;
} {
  if (standardInterests.length < 3) {
    return {
      valid: false,
      error: "A personal constellation requires at least 3 curated anchors.",
    };
  }
  return { valid: true, error: null };
}

export async function toggleInterestType(
  userId: string,
  currentStandard: string[],
  currentNiche: string[],
  interestName: string,
): Promise<{ success: boolean; standard: string[]; niche: string[]; error: string | null }> {
  const isCurrentlyStandard = currentStandard.includes(interestName);
  const isCurrentlyNiche = currentNiche.includes(interestName);

  if (!isCurrentlyStandard && !isCurrentlyNiche) {
    return {
      success: false,
      standard: currentStandard,
      niche: currentNiche,
      error: `Interest "${interestName}" is not present in user constellation.`,
    };
  }

  let nextStandard: string[];
  let nextNiche: string[];

  if (isCurrentlyStandard) {
    if (currentStandard.length <= 3) {
      return {
        success: false,
        standard: currentStandard,
        niche: currentNiche,
        error: "Cannot convert to niche obsession: you need at least 3 curated anchors.",
      };
    }
    nextStandard = currentStandard.filter((n) => n !== interestName);
    nextNiche = [...currentNiche, interestName];
  } else {
    nextNiche = currentNiche.filter((n) => n !== interestName);
    nextStandard = [...currentStandard, interestName];
  }

  const { success, error } = await saveUserInterests(userId, nextStandard, nextNiche);
  if (!success) {
    return { success: false, standard: currentStandard, niche: currentNiche, error };
  }

  return { success: true, standard: nextStandard, niche: nextNiche, error: null };
}
