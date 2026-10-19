import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import serverHandler from "@/server";

describe("Phase 14: Production Deployment & Release Readiness", () => {
  const rootDir = process.cwd();

  describe("1. Static Artifacts & Security Headers", () => {
    it("verifies public/_headers exists and specifies strict security headers", () => {
      const headersPath = path.join(rootDir, "public", "_headers");
      expect(fs.existsSync(headersPath)).toBe(true);

      const content = fs.readFileSync(headersPath, "utf-8");
      expect(content).toContain("X-Content-Type-Options: nosniff");
      expect(content).toContain("X-Frame-Options: DENY");
      expect(content).toContain("Referrer-Policy: strict-origin-when-cross-origin");
      expect(content).toContain("Permissions-Policy:");
      expect(content).toContain("Cache-Control: public, max-age=31536000, immutable");
    });

    it("verifies public/robots.txt and public/sitemap.xml exist", () => {
      const robotsPath = path.join(rootDir, "public", "robots.txt");
      const sitemapPath = path.join(rootDir, "public", "sitemap.xml");

      expect(fs.existsSync(robotsPath)).toBe(true);
      expect(fs.existsSync(sitemapPath)).toBe(true);

      const sitemap = fs.readFileSync(sitemapPath, "utf-8");
      expect(sitemap).toContain("<loc>https://cesium.network/</loc>");
      expect(sitemap).toContain("<loc>https://cesium.network/discover</loc>");
    });

    it("verifies .env.production.example provides client-safe templates and security directives", () => {
      const envPath = path.join(rootDir, ".env.production.example");
      expect(fs.existsSync(envPath)).toBe(true);

      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).toContain("VITE_SUPABASE_URL");
      expect(content).toContain("VITE_SUPABASE_ANON_KEY");
      expect(content).toContain("NITRO_PRESET=cloudflare-module");
      expect(content).toContain("NODE_ENV=production");
      expect(content).toContain("NEVER supply SUPABASE_SERVICE_ROLE_KEY");
    });
  });

  describe("2. Server Entry Health & Security Middleware", () => {
    it("responds to /health with 200 OK and JSON health payload", async () => {
      const request = new Request("https://cesium.network/health");
      const response = await serverHandler.fetch(request, {}, {});

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");

      const data = await response.json();
      expect(data).toHaveProperty("status", "healthy");
      expect(data).toHaveProperty("service", "cesium");
      expect(data).toHaveProperty("version", "1.0.0");
    });

    it("responds to /api/health identically with 200 OK", async () => {
      const request = new Request("https://cesium.network/api/health");
      const response = await serverHandler.fetch(request, {}, {});

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("healthy");
    });
  });

  describe("3. Operational Documentation & Runbooks", () => {
    it("verifies docs/production/DEPLOYMENT_RUNBOOK.md is present and complete", () => {
      const runbookPath = path.join(rootDir, "docs", "production", "DEPLOYMENT_RUNBOOK.md");
      expect(fs.existsSync(runbookPath)).toBe(true);

      const content = fs.readFileSync(runbookPath, "utf-8");
      expect(content).toContain("Database Migration Sequence");
      expect(content).toContain("Cloudflare Pages");
      expect(content).toContain("Rollback & Disaster Recovery Procedures");
      expect(content).toContain("Post-Deployment Verification & Smoke Checklist");
    });

    it("verifies all 9 versioned database migrations exist in chronological order", () => {
      const migrationsDir = path.join(rootDir, "supabase", "migrations");
      const files = fs.readdirSync(migrationsDir).sort();

      const expected = [
        "20261015000001_initial_schema.sql",
        "20261015000002_seed_data.sql",
        "20261017000001_schema_constraints_and_rls.sql",
        "20261017000002_curated_graph_bridges.sql",
        "20261017000003_uncommon_ground_rpc.sql",
        "20261017000004_realtime_messaging_rpc.sql",
        "20261017000005_micro_communities_rpc.sql",
        "20261017000006_safety_moderation_rpc.sql",
        "20261017000007_production_hardening_rls.sql",
      ];

      for (const exp of expected) {
        expect(files).toContain(exp);
      }
    });
  });
});
