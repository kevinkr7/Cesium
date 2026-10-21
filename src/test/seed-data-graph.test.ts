import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { interestCategories, people, communities } from "@/lib/data";
import {
  fetchInterestCatalog,
  fetchConstellationGraph,
  fetchRelatedInterests,
  CURATED_GRAPH_EDGES,
} from "@/services/interests";
import { getIcebreakerStarters } from "@/services/messaging";

describe("Phase 3: Seed Data, Graph Relations & Constellation Integrity", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const seedMigrationPath = path.join(migrationsDir, "20261015000002_seed_data.sql");
  const bridgesMigrationPath = path.join(migrationsDir, "20261017000002_curated_graph_bridges.sql");

  const seedSql = fs.readFileSync(seedMigrationPath, "utf-8");
  const bridgesSql = fs.readFileSync(bridgesMigrationPath, "utf-8");

  // Flat list of all 29 interests from static catalog
  const allInterestNames = Object.values(interestCategories).flat();
  const allSlugs = allInterestNames.map((name) =>
    name === "01:43 AM ideas"
      ? "0143-am-ideas"
      : name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
  );

  describe("1. Curated Seed Interests & Categories", () => {
    it("contains exactly 29 curated interests across exactly 7 categories", () => {
      const categories = Object.keys(interestCategories);
      expect(categories).toHaveLength(7);
      expect(categories).toEqual([
        "Creative",
        "Technology",
        "Music",
        "Science",
        "Culture",
        "Gaming",
        "Unusual obsessions",
      ]);

      expect(allInterestNames).toHaveLength(29);
      expect(new Set(allInterestNames).size).toBe(29); // Unique names
      expect(new Set(allSlugs).size).toBe(29); // Unique slugs
    });

    it("verifies distribution across all categories", () => {
      expect(interestCategories["Creative"]).toHaveLength(5);
      expect(interestCategories["Technology"]).toHaveLength(4);
      expect(interestCategories["Music"]).toHaveLength(4);
      expect(interestCategories["Science"]).toHaveLength(4);
      expect(interestCategories["Culture"]).toHaveLength(4);
      expect(interestCategories["Gaming"]).toHaveLength(4);
      expect(interestCategories["Unusual obsessions"]).toHaveLength(4);
    });

    it("verifies SQL seed migration defines all 29 interests with ON CONFLICT resolution", () => {
      for (const slug of allSlugs) {
        expect(seedSql).toContain(`('${slug}'`);
      }
      expect(seedSql).toContain("ON CONFLICT (slug) DO UPDATE");
    });
  });

  describe("2. Graph Relations & Constellation Edge Integrity", () => {
    it("ensures all curated graph edges reference valid interests in catalog", () => {
      expect(CURATED_GRAPH_EDGES.length).toBeGreaterThanOrEqual(13);

      for (const [source, target, weight, relType] of CURATED_GRAPH_EDGES) {
        expect(allSlugs).toContain(source);
        expect(allSlugs).toContain(target);
        expect(source).not.toBe(target); // No self-loops
        expect(weight).toBeGreaterThanOrEqual(0.0);
        expect(weight).toBeLessThanOrEqual(1.0);
        expect(["related", "cross-domain"]).toContain(relType);
      }
    });

    it("verifies cross-disciplinary bridges linking distinct domains", () => {
      const crossDomainEdges = CURATED_GRAPH_EDGES.filter((e) => e[3] === "cross-domain");
      expect(crossDomainEdges.length).toBeGreaterThanOrEqual(4);

      // Verify specific bridge pairings exist
      const pairs = crossDomainEdges.map(([s, t]) => `${s}:${t}`);
      expect(pairs).toContain("creative-coding:astronomy"); // Tech -> Science
      expect(pairs).toContain("film-photography:indie-cinema"); // Creative -> Culture
      expect(pairs).toContain("ambient-music:film-photography"); // Music -> Creative
      expect(pairs).toContain("brutalist-architecture:abandoned-railways"); // Culture -> Obsessions
    });

    it("verifies additive migration seeds the cross-disciplinary bridges", () => {
      expect(bridgesSql).toContain("creative-coding");
      expect(bridgesSql).toContain("astronomy");
      expect(bridgesSql).toContain("film-photography");
      expect(bridgesSql).toContain("indie-cinema");
      expect(bridgesSql).toContain("ambient-music");
      expect(bridgesSql).toContain("brutalist-architecture");
      expect(bridgesSql).toContain("abandoned-railways");
      expect(bridgesSql).toContain("ON CONFLICT (interest_a, interest_b) DO UPDATE");
    });

    it("assembles complete constellation graph via fetchConstellationGraph", async () => {
      const graph = await fetchConstellationGraph();

      expect(graph.nodes.length).toBeGreaterThanOrEqual(29);
      expect(graph.edges.length).toBeGreaterThanOrEqual(13);

      const nodeSlugs = new Set(graph.nodes.map((n) => n.slug));
      for (const edge of graph.edges) {
        expect(nodeSlugs.has(edge.source)).toBe(true);
        expect(nodeSlugs.has(edge.target)).toBe(true);
        expect(edge.weight).toBeGreaterThanOrEqual(0.0);
        expect(edge.weight).toBeLessThanOrEqual(1.0);
      }
    });

    it("supports symmetric / bidirectional traversal via fetchRelatedInterests", async () => {
      const relatedToCreativeCoding = await fetchRelatedInterests("creative-coding");
      const relatedToSynthesizers = await fetchRelatedInterests("synthesizers");

      // creative-coding -> synthesizers
      const synthFromCoding = relatedToCreativeCoding.find((r) => r.slug === "synthesizers");
      expect(synthFromCoding).toBeDefined();

      // synthesizers -> creative-coding (symmetric traversal)
      const codingFromSynth = relatedToSynthesizers.find((r) => r.slug === "creative-coding");
      expect(codingFromSynth).toBeDefined();

      // Weights must be identical across reciprocal lookup
      expect(synthFromCoding?.weight).toBe(codingFromSynth?.weight);
    });
  });

  describe("3. Starter Micro-Communities & Topic Associations", () => {
    it("contains exactly 5 starter communities in SQL and client data", () => {
      expect(communities).toHaveLength(5);
      const communityIds = communities.map((c) => c.id);
      expect(communityIds).toEqual([
        "2am-builders",
        "sound-syntax",
        "orbit-club",
        "frame-by-frame",
        "spore-society",
      ]);

      for (const id of communityIds) {
        expect(seedSql).toContain(`('${id}', '${id}'`);
      }
    });

    it("ensures every starter community topic maps to a valid seed interest", () => {
      for (const comm of communities) {
        expect(comm.name).toBeTruthy();
        expect(comm.line).toBeTruthy();
        expect(comm.description).toBeTruthy();
        expect(comm.topics.length).toBeGreaterThan(0);

        for (const topic of comm.topics) {
          // Topics should either match catalog interest names or standard topics
          if (topic !== "Making things" && topic !== "Strange questions") {
            expect(allInterestNames).toContain(topic);
          }
        }
      }
    });

    it("verifies seed SQL attaches community interests correctly", () => {
      expect(seedSql).toContain("INSERT INTO public.community_interests");
      expect(seedSql).toContain("'2am-builders'");
      expect(seedSql).toContain("'sound-syntax'");
      expect(seedSql).toContain("'orbit-club'");
      expect(seedSql).toContain("'frame-by-frame'");
      expect(seedSql).toContain("'spore-society'");
    });
  });

  describe("4. Sample Profiles & Completeness Assertions", () => {
    it("contains sample people with complete, valid profile attributes", () => {
      expect(people.length).toBeGreaterThanOrEqual(1);

      for (const person of people) {
        expect(person.id).toBeTruthy();
        expect(person.name).toBeTruthy();
        expect(person.handle).toMatch(/^@[a-zA-Z0-9_.-]+$/);
        expect(person.city).toBeTruthy();
        expect(person.bio.length).toBeGreaterThan(10);
        expect(person.bio.length).toBeLessThanOrEqual(240); // Within schema constraint
        expect(person.why).toBeTruthy();
        expect(person.interests.length).toBeGreaterThanOrEqual(3);

        // All person interests must exist in the 29 catalog
        for (const interest of person.interests) {
          expect(allInterestNames).toContain(interest);
        }
      }
    });
  });

  describe("5. Seed Icebreakers & Conversation Starters", () => {
    it("provides high quality icebreakers for all 29 seed interests", () => {
      for (const interest of allInterestNames) {
        const starters = getIcebreakerStarters([interest]);
        expect(starters.length).toBeGreaterThan(0);
        expect(starters[0]).toBeTruthy();
        expect(starters[0]?.endsWith("?")).toBe(true);
      }
    });

    it("generates relevant starters for multi-interest overlap", () => {
      const starters = getIcebreakerStarters(["Creative coding", "Synthesizers"]);
      expect(starters).toHaveLength(3); // 2 tailored prompts + 1 filler ensuring 3 prompts
      expect(starters[0]).toContain("visual bug");
      expect(starters[1]).toContain("modular");
    });
  });

  describe("6. Catalog Service Fallback Handling", () => {
    it("fetchInterestCatalog returns all 29 items in clean unauthenticated/offline state", async () => {
      const catalog = await fetchInterestCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(29);
      for (const item of catalog) {
        expect(item.id).toBeTruthy();
        expect(item.slug).toBeTruthy();
        expect(item.name).toBeTruthy();
        expect(item.category).toBeTruthy();
      }
    });
  });
});
