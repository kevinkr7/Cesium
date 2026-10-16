import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 15: Database Migrations & Schema Integrity", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");

  it("ensures versioned SQL migration files exist", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir);
    expect(files).toContain("20261015000001_initial_schema.sql");
    expect(files).toContain("20261015000002_seed_data.sql");
  });

  it("verifies all required tables are defined in initial_schema.sql", () => {
    const schemaFile = path.join(migrationsDir, "20261015000001_initial_schema.sql");
    const content = fs.readFileSync(schemaFile, "utf-8");

    const requiredTables = [
      "public.profiles",
      "public.interests",
      "public.user_interests",
      "public.interest_relations",
      "public.connections",
      "public.conversations",
      "public.conversation_members",
      "public.messages",
      "public.communities",
      "public.community_members",
      "public.community_interests",
      "public.community_posts",
      "public.community_replies",
      "public.blocked_users",
      "public.user_reports",
      "public.notifications",
    ];

    for (const table of requiredTables) {
      expect(content).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("verifies Row Level Security is explicitly enabled on all tables", () => {
    const schemaFile = path.join(migrationsDir, "20261015000001_initial_schema.sql");
    const content = fs.readFileSync(schemaFile, "utf-8");

    const rlsTables = [
      "public.profiles",
      "public.interests",
      "public.user_interests",
      "public.connections",
      "public.conversations",
      "public.messages",
      "public.communities",
      "public.blocked_users",
      "public.user_reports",
      "public.notifications",
    ];

    for (const table of rlsTables) {
      expect(content).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("verifies transactional RPC functions are defined", () => {
    const schemaFile = path.join(migrationsDir, "20261015000001_initial_schema.sql");
    const content = fs.readFileSync(schemaFile, "utf-8");

    expect(content).toContain("FUNCTION public.rpc_send_connection_request");
    expect(content).toContain("FUNCTION public.rpc_respond_to_connection_request");
    expect(content).toContain("FUNCTION public.rpc_send_message");
    expect(content).toContain("FUNCTION public.rpc_get_discovery");
  });
});
