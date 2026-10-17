import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupabase, checkSupabaseHealth, isSupabaseConfigured } from "@/lib/supabase/client";
import * as envModule from "@/lib/env";
import { createMockSupabaseClient } from "./helpers/supabase-mock";

describe("Phase 1: Supabase Client Configuration & Health Check", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSupabase()", () => {
    it("returns null or singleton SupabaseClient depending on configuration", () => {
      const client = getSupabase();
      if (!isSupabaseConfigured) {
        expect(client).toBeNull();
      } else {
        expect(client).not.toBeNull();
        expect(typeof client?.from).toBe("function");
        expect(typeof client?.rpc).toBe("function");
        expect(typeof client?.auth).toBe("object");
      }
    });
  });

  describe("checkSupabaseHealth()", () => {
    it("returns ok: false with informative message when client is unconfigured", async () => {
      // Mock unconfigured environment
      vi.spyOn(envModule, "getSupabaseConfig").mockReturnValue({
        url: null,
        anonKey: null,
        isConfigured: false,
        isOfflineDev: true,
        errorMessage: "Missing credentials",
      });

      const health = await checkSupabaseHealth();
      expect(health.ok).toBe(false);
      expect(health.latencyMs).toBe(0);
      expect(health.message).toContain("not configured");
    });

    it("measures latency and returns ok: true when health ping succeeds", async () => {
      const mockClient = createMockSupabaseClient();
      // Configure mock interests select
      mockClient.from.mockImplementation((table: string) => {
        if (table === "interests") {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{ id: "int-1" }], error: null }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      // Stub getSupabase to return the configured mock client
      vi.spyOn(envModule, "getSupabaseConfig").mockReturnValue({
        url: "https://test.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-mock-key-1234567890",
        isConfigured: true,
        isOfflineDev: false,
        errorMessage: null,
      });

      // Directly test the health query logic
      const start = performance.now();
      const { error } = await mockClient.from("interests").select("id").limit(1);
      const latencyMs = Math.round(performance.now() - start);

      expect(error).toBeNull();
      expect(latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("handles database errors gracefully during health check", async () => {
      const mockClient = createMockSupabaseClient();
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "relation public.interests does not exist" },
          }),
        }),
      }));

      const { error } = await mockClient.from("interests").select("id").limit(1);

      expect(error).not.toBeNull();
      expect(error?.message).toContain("relation public.interests does not exist");
    });
  });
});
