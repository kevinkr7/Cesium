import { getSupabase } from "@/lib/supabase/client";
import { people, interestCategories, type Person, shared } from "@/lib/data";

export type DiscoveryCandidate = {
  id: string;
  name: string;
  handle: string;
  city: string;
  photo?: string;
  bio: string;
  interests: string[];
  sharedInterests: string[];
  matchScore: number;
  why: string;
  connectionStatus: "none" | "pending" | "connected";
  recent?: boolean;
  featured?: boolean;
};

export function getCategoryOf(interestName: string): string {
  for (const [cat, items] of Object.entries(interestCategories)) {
    if (items.includes(interestName)) return cat;
  }
  return "Unusual obsessions";
}

/**
 * Deterministic Overlap Engine matching score formula
 * Jaccard-style base score + Primary interest bonus + Category diversity bonus
 */
export function computeMatchScore(
  myInterests: string[],
  theirInterests: string[],
  primaryInterests: string[] = [],
): { score: number; sharedList: string[]; explanation: string } {
  const sharedList = shared(myInterests, theirInterests);
  const totalUnion = new Set([...myInterests, ...theirInterests]).size;

  if (totalUnion === 0 || sharedList.length === 0) {
    return {
      score: 0,
      sharedList: [],
      explanation: "Different constellations waiting to cross paths.",
    };
  }

  // Base Jaccard score (0 - 60 points)
  const jaccard = sharedList.length / totalUnion;
  let score = jaccard * 60;

  // Primary shared bonus (+12 points per shared primary)
  const sharedPrimary = sharedList.filter((x) => primaryInterests.includes(x)).length;
  score += sharedPrimary * 12;

  // Category diversity bonus (+6 points per shared unique category)
  const sharedCategories = new Set(sharedList.map(getCategoryOf)).size;
  score += sharedCategories * 6;

  // Bound score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  // Deterministic explanation template based on factual shared data
  let explanation = "";
  if (sharedList.length >= 3) {
    explanation = `You both explore ${sharedList[0]}, ${sharedList[1]} and ${sharedList[2]}.`;
  } else if (sharedList.length === 2) {
    explanation = `You share common ground in ${sharedList[0]} and ${sharedList[1]}.`;
  } else if (sharedList.length === 1) {
    explanation = `You both have an affinity for ${sharedList[0]}.`;
  } else {
    explanation = "Different constellations waiting to cross paths.";
  }

  return { score: finalScore, sharedList, explanation };
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

export async function fetchDiscoveryPeople(
  myInterests: string[],
  filter?: string | null,
  searchQuery?: string,
  connectionsRecord: Record<string, "pending" | "connected"> = {},
): Promise<DiscoveryCandidate[]> {
  const sb = getSupabase();

  if (sb) {
    const { data, error } = await sb.rpc("rpc_get_discovery", {
      p_filter: filter ?? "all",
      p_query: searchQuery ?? "",
      p_limit: 30,
      p_offset: 0,
    });

    if (!error && data && data.length > 0) {
      return data.map((r) => ({
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
  }

  // Deterministic fallback matching based on actual profile dataset
  return people
    .map((p) => {
      const { score, sharedList, explanation } = computeMatchScore(
        myInterests,
        p.interests,
        myInterests.slice(0, 3),
      );
      const connStatus = connectionsRecord[p.id] ?? "none";
      const why =
        filter === "Uncommon connections" && sharedList.length <= 1
          ? computeUncommonGroundExplanation(myInterests, p.interests)
          : explanation || p.why;

      return {
        id: p.id,
        name: p.name,
        handle: p.handle,
        city: p.city,
        photo: p.photo,
        bio: p.bio,
        interests: p.interests,
        sharedInterests: sharedList,
        matchScore: score,
        why,
        connectionStatus: connStatus,
        recent: p.recent,
        featured: p.featured,
      };
    })
    .filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const text = `${p.name} ${p.bio} ${p.interests.join(" ")}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (filter === "Shared interests") return p.sharedInterests.length >= 2;
      if (filter === "Uncommon connections") return p.sharedInterests.length <= 1;
      if (filter === "Recently discovered") return p.recent;
      return true;
    })
    .sort((a, b) => {
      if (filter === "Uncommon connections") {
        return a.matchScore - b.matchScore;
      }
      return b.matchScore - a.matchScore;
    });
}
