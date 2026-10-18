import { getSupabase } from "@/lib/supabase/client";
import { people, interestCategories, shared } from "@/lib/data";
import { CURATED_GRAPH_EDGES } from "@/services/interests";

export type DiscoveryCandidate = {
  id: string;
  name: string;
  handle: string;
  city: string;
  photo?: string | undefined;
  bio: string;
  interests: string[];
  sharedInterests: string[];
  matchScore: number;
  why: string;
  connectionStatus: "none" | "pending" | "connected";
  recent?: boolean | undefined;
  featured?: boolean | undefined;
};

export type CrossDomainBridge = {
  from: string;
  to: string;
  weight: number;
  relationType: string;
  explanation: string;
};

export type MatchScoreBreakdown = {
  jaccardBase: number;
  primaryBonus: number;
  categoryBonus: number;
  styleBonus: number;
  bridgeBonus: number;
};

export type MatchScoreOptions = {
  primaryInterests?: string[] | undefined;
  myStyles?: string[] | string | undefined;
  theirStyles?: string[] | string | undefined;
  includeBridges?: boolean | undefined;
};

export type MatchResult = {
  score: number;
  sharedList: string[];
  explanation: string;
  bridges?: CrossDomainBridge[] | undefined;
  breakdown?: MatchScoreBreakdown | undefined;
};

export const COMPLEMENTARY_STYLE_PAIRS: [string, string][] = [
  ["deep dives", "slow & thoughtful"],
  ["deep dives", "technical"],
  ["listener", "deep dives"],
  ["listener", "playful banter"],
  ["listener", "rapid-fire ideas"],
  ["listener", "slow & thoughtful"],
  ["technical", "show, don't tell"],
  ["technical", "deep dives"],
  ["rapid-fire ideas", "playful banter"],
  ["slow & thoughtful", "voice notes"],
];

export function slugifyInterest(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getCategoryOf(interestName: string): string {
  for (const [cat, items] of Object.entries(interestCategories)) {
    if (items.includes(interestName)) return cat;
  }
  return "Unusual obsessions";
}

/**
 * Identify 1-hop cross-domain graph bridges between two interest sets
 */
export function findCrossDomainBridges(
  myInterests: string[],
  theirInterests: string[],
): CrossDomainBridge[] {
  const mySlugs = myInterests.map((name) => ({ name, slug: slugifyInterest(name) }));
  const theirSlugs = theirInterests.map((name) => ({ name, slug: slugifyInterest(name) }));
  const directShared = new Set(shared(myInterests, theirInterests).map(slugifyInterest));

  const foundBridges: CrossDomainBridge[] = [];
  const seenPairs = new Set<string>();

  for (const [source, target, weight, relationType, explanation] of CURATED_GRAPH_EDGES) {
    for (const m of mySlugs) {
      if (directShared.has(m.slug)) continue;
      for (const t of theirSlugs) {
        if (directShared.has(t.slug)) continue;
        if (m.slug === t.slug) continue;

        const isForward = m.slug === source && t.slug === target;
        const isReverse = m.slug === target && t.slug === source;

        if (isForward || isReverse) {
          const pairKey = [m.slug, t.slug].sort().join("<->");
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            foundBridges.push({
              from: m.name,
              to: t.name,
              weight,
              relationType,
              explanation,
            });
          }
        }
      }
    }
  }

  return foundBridges;
}

/**
 * Calculate conversation style resonance and synergy
 */
export function calculateStyleSynergy(
  myStyles?: string[] | string | undefined,
  theirStyles?: string[] | string | undefined,
): { synergy: boolean; bonus: number; matchedStyle?: string | undefined } {
  if (!myStyles || !theirStyles) return { synergy: false, bonus: 0 };

  const norm = (s: string[] | string): string[] =>
    (Array.isArray(s) ? s : [s]).map((x) => x.trim().toLowerCase()).filter(Boolean);

  const mine = norm(myStyles);
  const theirs = norm(theirStyles);

  if (mine.length === 0 || theirs.length === 0) return { synergy: false, bonus: 0 };

  // 1. Direct shared style (e.g. both prefer "Deep dives")
  for (const m of mine) {
    if (theirs.includes(m)) {
      return { synergy: true, bonus: 6, matchedStyle: m };
    }
  }

  // 2. Complementary conversation pairs
  for (const m of mine) {
    for (const t of theirs) {
      for (const [pairA, pairB] of COMPLEMENTARY_STYLE_PAIRS) {
        if ((m === pairA && t === pairB) || (m === pairB && t === pairA)) {
          return { synergy: true, bonus: 6, matchedStyle: `${m} + ${t}` };
        }
      }
    }
  }

  return { synergy: false, bonus: 0 };
}

/**
 * Deterministic Overlap Engine matching score formula
 * Jaccard-style base score + Primary interest bonus + Category diversity bonus + Style synergy + Cross-domain bridges
 */
export function computeMatchScore(
  myInterests: string[],
  theirInterests: string[],
  primaryInterestsOrOptions: string[] | MatchScoreOptions = [],
): MatchResult {
  const options: MatchScoreOptions = Array.isArray(primaryInterestsOrOptions)
    ? { primaryInterests: primaryInterestsOrOptions }
    : (primaryInterestsOrOptions ?? {});

  const primaryInterests = options.primaryInterests ?? [];
  const includeBridges = options.includeBridges ?? true;

  const sharedList = shared(myInterests, theirInterests);
  const totalUnion = new Set([...myInterests, ...theirInterests]).size;

  // Find 1-hop cross domain bridges
  const bridges = includeBridges ? findCrossDomainBridges(myInterests, theirInterests) : [];

  if (totalUnion === 0) {
    return {
      score: 0,
      sharedList: [],
      explanation: "Different constellations waiting to cross paths.",
      bridges: [],
      breakdown: {
        jaccardBase: 0,
        primaryBonus: 0,
        categoryBonus: 0,
        styleBonus: 0,
        bridgeBonus: 0,
      },
    };
  }

  // Base Jaccard score (0 - 60 points)
  const jaccard = totalUnion > 0 ? sharedList.length / totalUnion : 0;
  const jaccardBase = jaccard * 60;

  // Primary shared bonus (+12 points per shared primary)
  const sharedPrimary = sharedList.filter((x) => primaryInterests.includes(x)).length;
  const primaryBonus = sharedPrimary * 12;

  // Category diversity bonus (+6 points per shared unique category)
  const sharedCategories = new Set(sharedList.map(getCategoryOf)).size;
  const categoryBonus = sharedCategories * 6;

  // Style synergy bonus (+6 points)
  const styleResult = calculateStyleSynergy(options.myStyles, options.theirStyles);
  const styleBonus = styleResult.bonus;

  // Cross-domain bridge bonus (capped at 2 bridges, weighted by bridge.weight * 8)
  let bridgeBonus = 0;
  if (bridges.length > 0) {
    const scoredBridges = bridges.slice(0, 2);
    bridgeBonus = scoredBridges.reduce((sum, b) => sum + Math.round(b.weight * 8), 0);
  }

  // If there are neither shared interests nor bridges nor style synergy
  if (sharedList.length === 0 && bridges.length === 0 && styleBonus === 0) {
    return {
      score: 0,
      sharedList: [],
      explanation: "Different constellations waiting to cross paths.",
      bridges: [],
      breakdown: {
        jaccardBase: 0,
        primaryBonus: 0,
        categoryBonus: 0,
        styleBonus: 0,
        bridgeBonus: 0,
      },
    };
  }

  // Total raw score
  const rawScore = jaccardBase + primaryBonus + categoryBonus + styleBonus + bridgeBonus;

  // Bound score strictly between 0 and 100
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Deterministic explanation template based on factual shared data and bridges
  let explanation = "";
  const s0 = sharedList[0] ?? "";
  const s1 = sharedList[1] ?? "";
  const s2 = sharedList[2] ?? "";
  const b0 = bridges[0];

  if (sharedList.length >= 3) {
    explanation = `You both explore ${s0}, ${s1} and ${s2}.`;
  } else if (sharedList.length === 2) {
    explanation = `You share common ground in ${s0} and ${s1}.`;
  } else if (sharedList.length === 1) {
    if (b0) {
      explanation = `You both have an affinity for ${s0}, connected across domains via ${b0.from} ↔ ${b0.to}.`;
    } else {
      explanation = `You both have an affinity for ${s0}.`;
    }
  } else if (b0) {
    explanation = `Bridging distinct worlds: ${b0.from} connects with ${b0.to}.`;
  } else {
    explanation = "Different constellations waiting to cross paths.";
  }

  return {
    score: finalScore,
    sharedList,
    explanation,
    bridges,
    breakdown: {
      jaccardBase: Math.round(jaccardBase * 100) / 100,
      primaryBonus,
      categoryBonus,
      styleBonus,
      bridgeBonus,
    },
  };
}

/**
 * Uncommon Ground calculation: identifies profiles with meaningful differences alongside 1 shared anchor
 */
export function computeUncommonGroundExplanation(
  myInterests: string[],
  theirInterests: string[],
): string {
  const sharedList = shared(myInterests, theirInterests);
  const anchor = sharedList[0];
  const different = theirInterests.filter((x) => !myInterests.includes(x))[0];

  if (anchor && different) {
    return `You both connect over ${anchor}, but their interest in ${different} opens an entirely different orbit.`;
  }
  return "An uncommon overlap of disparate perspectives and shared curiosity.";
}

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

export async function fetchDiscoveryPeople(
  myInterests: string[],
  filter?: string | null,
  searchQuery?: string,
  connectionsRecord: Record<string, "pending" | "connected"> = {},
  options?: {
    primaryInterests?: string[] | undefined;
    myStyles?: string[] | string | undefined;
  },
): Promise<DiscoveryCandidate[]> {
  const sb = getSupabase();

  if (sb) {
    try {
      const res = await withTimeout(
        sb.rpc("rpc_get_discovery", {
          p_filter: filter ?? "all",
          p_query: searchQuery ?? "",
          p_limit: 30,
          p_offset: 0,
        }),
        1500,
      );

      if (res && !res.error && res.data && res.data.length > 0) {
        return res.data.map((r) => ({
          id: r.id,
          name: r.display_name,
          handle: r.handle,
          city: r.city ?? "Worldwide",
          photo: r.avatar_path ?? undefined,
          bio: r.bio ?? "",
          interests: r.interests,
          sharedInterests: r.shared_interests,
          matchScore: Number(r.match_score),
          why: r.explanation,
          connectionStatus: (r.connection_status as "none" | "pending" | "connected") ?? "none",
        }));
      }
    } catch {
      // Fallback gracefully to client deterministic matching
    }
  }

  // Deterministic fallback matching based on actual profile dataset
  return people
    .map((p) => {
      const matchResult = computeMatchScore(myInterests, p.interests, {
        primaryInterests: options?.primaryInterests ?? myInterests.slice(0, 3),
        myStyles: options?.myStyles,
        includeBridges: true,
      });
      const connStatus: "none" | "pending" | "connected" =
        (connectionsRecord[p.id] as "none" | "pending" | "connected") ?? "none";
      const why =
        filter === "Uncommon connections" && matchResult.sharedList.length <= 1
          ? computeUncommonGroundExplanation(myInterests, p.interests)
          : matchResult.explanation || p.why;

      return {
        id: p.id,
        name: p.name,
        handle: p.handle,
        city: p.city,
        photo: p.photo,
        bio: p.bio,
        interests: p.interests,
        sharedInterests: matchResult.sharedList,
        matchScore: matchResult.score,
        why,
        connectionStatus: connStatus,
        recent: p.recent,
        featured: p.featured,
      };
    })
    .filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const text =
          `${p.name} ${p.handle} ${p.city} ${p.bio} ${p.interests.join(" ")}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (filter === "Shared interests") return p.sharedInterests.length >= 2;
      if (filter === "Uncommon connections") return p.sharedInterests.length <= 1;
      if (filter === "Recently discovered") return !!p.recent;
      return true;
    })
    .sort((a, b) => {
      if (filter === "Uncommon connections") {
        if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
        return a.name.localeCompare(b.name);
      }
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.name.localeCompare(b.name);
    });
}
