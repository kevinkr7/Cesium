import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 2: Database Migrations, Schema Constraints & RLS", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const initialSchemaFile = path.join(migrationsDir, "20261015000001_initial_schema.sql");
  const seedDataFile = path.join(migrationsDir, "20261015000002_seed_data.sql");
  const hardeningFile = path.join(migrationsDir, "20261017000001_schema_constraints_and_rls.sql");

  const initialContent = fs.readFileSync(initialSchemaFile, "utf-8");
  const hardeningContent = fs.readFileSync(hardeningFile, "utf-8");
  const allSqlContent = `${initialContent}\n${hardeningContent}`;

  it("ensures all versioned SQL migration files exist", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir);
    expect(files).toContain("20261015000001_initial_schema.sql");
    expect(files).toContain("20261015000002_seed_data.sql");
    expect(files).toContain("20261017000001_schema_constraints_and_rls.sql");
    expect(files).toContain("20261017000002_curated_graph_bridges.sql");
    expect(files).toContain("20261017000003_uncommon_ground_rpc.sql");
    expect(files).toContain("20261017000004_realtime_messaging_rpc.sql");
    expect(files).toContain("20261017000005_micro_communities_rpc.sql");
    expect(files).toContain("20261017000006_safety_moderation_rpc.sql");
    expect(files).toContain("20261017000007_production_hardening_rls.sql");
  });

  it("verifies all 16 required tables are defined in initial_schema.sql", () => {
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
      expect(initialContent).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("verifies Row Level Security is enabled on every table without exception", () => {
    const allTables = [
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

    for (const table of allTables) {
      expect(initialContent).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("verifies critical check constraints are defined to prevent invalid state", () => {
    // Integrity checks
    expect(initialContent).toContain(
      "CONSTRAINT no_self_connection CHECK (requester_id <> addressee_id)",
    );
    expect(initialContent).toContain("CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)");
    expect(initialContent).toContain("CONSTRAINT handle_length CHECK");
    expect(initialContent).toContain("CONSTRAINT display_name_length CHECK");
    expect(initialContent).toContain("CONSTRAINT bio_length CHECK");
    expect(initialContent).toContain("CONSTRAINT message_body_length CHECK");
    expect(initialContent).toContain("CONSTRAINT community_name_length CHECK");
    expect(initialContent).toContain("idx_connections_unordered_pair");
  });

  it("verifies comprehensive RLS policy coverage across all tables", () => {
    const expectedPolicies = [
      "profiles_select",
      "profiles_update",
      "profiles_insert",
      "interests_select",
      "interests_insert",
      "user_interests_select",
      "user_interests_insert",
      "user_interests_update",
      "user_interests_delete",
      "interest_relations_select",
      "connections_select",
      "connections_insert",
      "connections_update",
      "conversations_select",
      "conversations_insert",
      "conv_members_select",
      "conv_members_insert",
      "messages_select",
      "messages_insert",
      "messages_update",
      "communities_select",
      "communities_insert",
      "communities_update",
      "comm_members_select",
      "comm_members_insert",
      "comm_members_delete",
      "community_interests_select",
      "community_interests_insert",
      "community_interests_delete",
      "comm_posts_select",
      "comm_posts_insert",
      "comm_posts_delete",
      "comm_replies_select",
      "comm_replies_insert",
      "comm_replies_delete",
      "blocked_users_select",
      "blocked_users_insert",
      "blocked_users_delete",
      "notifications_select",
      "notifications_update",
      "notifications_delete",
    ];

    for (const policy of expectedPolicies) {
      expect(allSqlContent).toContain(policy);
    }
  });

  it("verifies updated_at and new user trigger functions exist", () => {
    expect(initialContent).toContain("FUNCTION public.handle_updated_at()");
    expect(initialContent).toContain("trg_profiles_updated_at");
    expect(initialContent).toContain("trg_connections_updated_at");
    expect(initialContent).toContain("trg_communities_updated_at");
    expect(initialContent).toContain("FUNCTION public.handle_new_user()");
    expect(initialContent).toContain("on_auth_user_created");
  });

  it("verifies transactional RPC functions are defined", () => {
    expect(initialContent).toContain("FUNCTION public.rpc_send_connection_request");
    expect(initialContent).toContain("FUNCTION public.rpc_respond_to_connection_request");
    expect(initialContent).toContain("FUNCTION public.rpc_send_message");
    expect(initialContent).toContain("FUNCTION public.rpc_get_discovery");
  });

  it("verifies public_assets storage bucket configuration in additive migration", () => {
    expect(hardeningContent).toContain("public_assets");
    expect(hardeningContent).toContain("storage.buckets");
    expect(hardeningContent).toContain("public_assets_select");
    expect(hardeningContent).toContain("public_assets_insert");
  });
});
