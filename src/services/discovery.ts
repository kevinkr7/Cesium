import { getSupabase } from "@/lib/supabase/client";
import { people, interestCategories, shared } from "@/lib/data";
import { CURATED_GRAPH_EDGES } from "@/services/interests";
import { sanitizeSearchQuery } from "@/lib/security";

export type UncommonGroundAnalysis = {
  anchor: string | null;
  novelInterests: string[];
  novelCategories: string[];
  contrastScore: number;
  perspectiveExplanation: string;
};

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
  uncommonGround?: UncommonGroundAnalysis | undefined;
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
  const myCategories = new Set(myInterests.map(getCategoryOf));
  const different = theirInterests.filter((x) => !myInterests.includes(x));
  const bridges = findCrossDomainBridges(myInterests, theirInterests);

  // Find a novel interest, prioritizing those in categories the user does not have
  const novelFromNewCategory = different.find((d) => !myCategories.has(getCategoryOf(d)));
  const novel = novelFromNewCategory ?? different[0];

  if (sharedList.length > 0 && sharedList[0]) {
    const anchor = sharedList[0];
    if (novel) {
      const cat = getCategoryOf(novel);
      const catSuffix = cat !== "Unusual obsessions" && !myCategories.has(cat) ? ` (${cat})` : "";
      return `You both connect over ${anchor}, but their interest in ${novel}${catSuffix} opens an entirely different orbit.`;
    }
    return `You both share common ground in ${anchor}, with space to explore new horizons together.`;
  }

  if (bridges.length > 0 && bridges[0]) {
    const b = bridges[0];
    const novelDesc = novel
      ? `with ${novel} offering uncharted territory`
      : "offering room for novel discovery";
    return `Connected across domains via ${b.from} ↔ ${b.to}, ${novelDesc}.`;
  }

  return "An uncommon overlap of disparate perspectives and shared curiosity.";
}

/**
 * Detailed Uncommon Ground analysis: extracts anchor, novel interests, category divergences, and serendipity contrast score
 */
export function analyzeUncommonGround(
  myInterests: string[],
  theirInterests: string[],
): UncommonGroundAnalysis {
  const sharedList = shared(myInterests, theirInterests);
  const bridges = findCrossDomainBridges(myInterests, theirInterests);

  let anchor: string | null = null;
  if (sharedList.length > 0 && sharedList[0]) {
    anchor = sharedList[0];
  } else if (bridges.length > 0 && bridges[0]) {
    anchor = `${bridges[0].from} ↔ ${bridges[0].to}`;
  }

  const novelInterests = theirInterests.filter((x) => !myInterests.includes(x));
  const myCategories = new Set(myInterests.map(getCategoryOf));
  const theirCategories = new Set(theirInterests.map(getCategoryOf));
  const novelCategories = Array.from(theirCategories).filter((cat) => !myCategories.has(cat));

  // Contrast / serendipity score (0 - 100)
  // Rewards 1 shared anchor plus broad exposure to novel categories/interests
  let baseAnchor = 0;
  if (sharedList.length === 1) {
    baseAnchor = 35; // Perfect 1-anchor sweet spot for uncommon ground
  } else if (sharedList.length > 1) {
    baseAnchor = Math.max(15, 35 - (sharedList.length - 1) * 8);
  } else if (bridges.length > 0) {
    baseAnchor = 25; // Connected via cross-domain bridge
  } else {
    baseAnchor = 5;
  }

  const categoryBonus = Math.min(40, novelCategories.length * 15);
  const interestBonus = Math.min(25, novelInterests.length * 5);
  const contrastScore = Math.min(
    100,
    Math.max(0, Math.round(baseAnchor + categoryBonus + interestBonus)),
  );

  const perspectiveExplanation = computeUncommonGroundExplanation(myInterests, theirInterests);

  return {
    anchor,
    novelInterests,
    novelCategories,
    contrastScore,
    perspectiveExplanation,
  };
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
    blockedUserIds?: string[] | undefined;
    currentUserId?: string | undefined;
    currentUserHandle?: string | undefined;
    currentUserEmail?: string | undefined;
  },
): Promise<DiscoveryCandidate[]> {
  const cleanQuery = searchQuery ? sanitizeSearchQuery(searchQuery) : "";
  const sb = getSupabase();

  if (sb) {
    try {
      // 1. Get current authenticated user ID so they are not shown to themselves
      const {
        data: { session: authSession },
      } = await sb.auth.getSession();
      const authUserId = authSession?.user?.id;
      const effectiveUserId = options?.currentUserId || authUserId;
      const effectiveHandle = options?.currentUserHandle?.toLowerCase().replace(/^@/, "");

      // 2. Fetch candidates from rpc_get_discovery with 5s timeout
      const rpcPromise = sb.rpc("rpc_get_discovery", {
        p_filter: filter ?? "all",
        p_query: cleanQuery,
        p_limit: 30,
        p_offset: 0,
      });

      // 3. Simultaneously query real registered profiles directly as a fallback/complement
      const profilesPromise = sb
        .from("profiles")
        .select(
          `
          id,
          handle,
          display_name,
          city,
          bio,
          avatar_path,
          onboarding_completed,
          discoverable,
          conversation_style,
          user_interests (
            is_niche,
            interests (
              name,
              category
            )
          )
        `,
        )
        .eq("discoverable", true)
        .limit(50);

      const [rpcRes, profilesRes] = await Promise.all([
        withTimeout(rpcPromise, 5000),
        withTimeout(profilesPromise, 5000),
      ]);

      const seenIds = new Set<string>();
      if (effectiveUserId) seenIds.add(effectiveUserId);
      if (authUserId) seenIds.add(authUserId);
      const candidates: DiscoveryCandidate[] = [];

      // Add RPC results if available
      if (rpcRes && !rpcRes.error && rpcRes.data && rpcRes.data.length > 0) {
        for (const r of rpcRes.data) {
          if (seenIds.has(r.id)) continue;
          if (effectiveHandle && r.handle?.toLowerCase().replace(/^@/, "") === effectiveHandle)
            continue;
          seenIds.add(r.id);

          const uncommonGround = analyzeUncommonGround(myInterests, r.interests || []);
          const why =
            filter === "Uncommon connections"
              ? uncommonGround.perspectiveExplanation
              : r.explanation;

          candidates.push({
            id: r.id,
            name: r.display_name,
            handle: r.handle,
            city: r.city ?? "Worldwide",
            photo: r.avatar_path ?? undefined,
            bio: r.bio ?? "",
            interests: r.interests || [],
            sharedInterests: r.shared_interests || [],
            matchScore: Number(r.match_score),
            why,
            connectionStatus: (connectionsRecord[r.id] ?? r.connection_status ?? "none") as
              "none" | "pending" | "connected",
            uncommonGround,
          });
        }
      }

      // Add any registered real users from the profiles query who were not already captured
      if (profilesRes && !profilesRes.error && profilesRes.data && profilesRes.data.length > 0) {
        for (const rp of profilesRes.data) {
          if (seenIds.has(rp.id)) continue;
          if (effectiveHandle && rp.handle?.toLowerCase().replace(/^@/, "") === effectiveHandle)
            continue;
          seenIds.add(rp.id);

          const rawInterests =
            (rp.user_interests as unknown as Array<{
              interests?: { name?: string | null; category?: string | null } | null;
            }>) || [];
          const theirInterests = rawInterests
            .map((ui) => ui.interests?.name)
            .filter((n): n is string => Boolean(n));

          const matchResult = computeMatchScore(myInterests, theirInterests, {
            primaryInterests: options?.primaryInterests ?? myInterests.slice(0, 3),
            myStyles: options?.myStyles,
            theirStyles: rp.conversation_style ?? undefined,
            includeBridges: true,
          });
          const uncommonGround = analyzeUncommonGround(myInterests, theirInterests);
          const connStatus: "none" | "pending" | "connected" = connectionsRecord[rp.id] ?? "none";
          const why =
            filter === "Uncommon connections" && matchResult.sharedList.length <= 1
              ? uncommonGround.perspectiveExplanation
              : matchResult.explanation;

          candidates.push({
            id: rp.id,
            name: rp.display_name,
            handle: rp.handle,
            city: rp.city ?? "Worldwide",
            photo: rp.avatar_path ?? undefined,
            bio: rp.bio ?? "",
            interests: theirInterests,
            sharedInterests: matchResult.sharedList,
            matchScore: matchResult.score,
            why,
            connectionStatus: connStatus,
            uncommonGround,
          });
        }
      }

      // Add starter/seed profiles so discovery feed has rich exploration alongside real users
      for (const p of people) {
        if (p.id === "auride") continue; // Excluded from discover, dedicated message companion
        if (seenIds.has(p.id)) continue;
        seenIds.add(p.id);

        const matchResult = computeMatchScore(myInterests, p.interests, {
          primaryInterests: options?.primaryInterests ?? myInterests.slice(0, 3),
          myStyles: options?.myStyles,
          includeBridges: true,
        });
        const uncommonGround = analyzeUncommonGround(myInterests, p.interests);
        const connStatus: "none" | "pending" | "connected" =
          (connectionsRecord[p.id] as "none" | "pending" | "connected") ?? "none";
        const why =
          filter === "Uncommon connections" && matchResult.sharedList.length <= 1
            ? uncommonGround.perspectiveExplanation
            : matchResult.explanation || p.why;

        candidates.push({
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
          uncommonGround,
        });
      }

      let filtered = candidates;
      const blocked = options?.blockedUserIds;
      if (blocked && blocked.length > 0) {
        filtered = filtered.filter((item) => !blocked.includes(item.id));
      }
      if (cleanQuery) {
        const q = cleanQuery.toLowerCase();
        filtered = filtered.filter((p) => {
          const text =
            `${p.name} ${p.handle} ${p.city} ${p.bio} ${p.interests.join(" ")}`.toLowerCase();
          return text.includes(q);
        });
      }
      if (filter === "Shared interests") {
        filtered = filtered.filter((p) => p.sharedInterests.length >= 2);
      } else if (filter === "Uncommon connections") {
        filtered = filtered.filter((p) => p.sharedInterests.length <= 1);
      } else if (filter === "Recently discovered") {
        filtered = filtered.filter((p) => Boolean(p.recent));
      }

      return filtered.sort((a, b) => {
        if (filter === "Uncommon connections") {
          if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
          return a.name.localeCompare(b.name);
        }
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return a.name.localeCompare(b.name);
      });
    } catch {
      // Fallback gracefully to client deterministic matching
    }
  }

  // Deterministic fallback matching based on actual profile dataset
  return people
    .filter((p) => p.id !== "auride")
    .map((p) => {
      const matchResult = computeMatchScore(myInterests, p.interests, {
        primaryInterests: options?.primaryInterests ?? myInterests.slice(0, 3),
        myStyles: options?.myStyles,
        includeBridges: true,
      });
      const uncommonGround = analyzeUncommonGround(myInterests, p.interests);
      const connStatus: "none" | "pending" | "connected" =
        (connectionsRecord[p.id] as "none" | "pending" | "connected") ?? "none";
      const why =
        filter === "Uncommon connections" && matchResult.sharedList.length <= 1
          ? uncommonGround.perspectiveExplanation
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
        uncommonGround,
      };
    })
    .filter((p) => {
      if (options?.currentUserId && p.id === options.currentUserId) return false;
      if (
        options?.currentUserHandle &&
        p.handle.toLowerCase().replace(/^@/, "") ===
          options.currentUserHandle.toLowerCase().replace(/^@/, "")
      )
        return false;
      if (options?.blockedUserIds && options.blockedUserIds.includes(p.id)) return false;
      if (cleanQuery) {
        const q = cleanQuery.toLowerCase();
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
