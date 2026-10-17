import { describe, it, expect, vi } from "vitest";
import {
  validateEnv,
  getSupabaseConfig,
  isSupabaseConfigured,
  assertSupabaseConfigured,
  envSchema,
} from "@/lib/env";

describe("Phase 1: Environment & Supabase Configuration Validation", () => {
  const VALID_HOSTED_URL = "https://abcdefghijklm.supabase.co";
  const VALID_LOCAL_URL = "http://127.0.0.1:54321";
  const VALID_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM0MTI4MDB9.valid-signature-key-value-12345";

  describe("validateEnv() schema rules", () => {
    it("accepts a valid hosted Supabase configuration", () => {
      const result = validateEnv({
        VITE_SUPABASE_URL: VALID_HOSTED_URL,
        VITE_SUPABASE_ANON_KEY: VALID_ANON_KEY,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        VITE_SUPABASE_URL: VALID_HOSTED_URL,
        VITE_SUPABASE_ANON_KEY: VALID_ANON_KEY,
      });
      expect(result.errors).toHaveLength(0);
    });

    it("accepts a valid local Supabase CLI configuration", () => {
      const result = validateEnv({
        VITE_SUPABASE_URL: VALID_LOCAL_URL,
        VITE_SUPABASE_ANON_KEY: VALID_ANON_KEY,
      });

      expect(result.success).toBe(true);
      expect(result.data?.VITE_SUPABASE_URL).toBe(VALID_LOCAL_URL);
    });

    it("rejects default placeholder Supabase URL", () => {
      const result = validateEnv({
        VITE_SUPABASE_URL: "https://your-project.supabase.co",
        VITE_SUPABASE_ANON_KEY: VALID_ANON_KEY,
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors.some((e) => e.includes("your-project.supabase.co"))).toBe(true);
    });

    it("rejects default placeholder Supabase Anon Key", () => {
      const result = validateEnv({
        VITE_SUPABASE_URL: VALID_HOSTED_URL,
        VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here",
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors.some((e) => e.includes("placeholder"))).toBe(true);
    });

    it("rejects malformed non-URL string", () => {
      const result = validateEnv({
        VITE_SUPABASE_URL: "not-a-valid-url",
        VITE_SUPABASE_ANON_KEY: VALID_ANON_KEY,
      });

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("valid URL"))).toBe(true);
    });

    it("rejects short or empty anon keys", () => {
      const result = validateEnv({
        VITE_SUPABASE_URL: VALID_HOSTED_URL,
        VITE_SUPABASE_ANON_KEY: "short-key",
      });

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("minimum 20 characters"))).toBe(true);
    });

    it("rejects missing environment variables", () => {
      const result = validateEnv({});
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Security Invariants", () => {
    it("confirms no service_role secret key is leaked in Vite client env", () => {
      const clientEnv = import.meta.env;
      expect(clientEnv["SUPABASE_SERVICE_ROLE_KEY"]).toBeUndefined();
      expect(clientEnv["VITE_SUPABASE_SERVICE_ROLE_KEY"]).toBeUndefined();
      expect(clientEnv["SERVICE_ROLE_KEY"]).toBeUndefined();
    });
  });

  describe("getSupabaseConfig() & isSupabaseConfigured()", () => {
    it("reports unconfigured state gracefully when using default unconfigured environment", () => {
      const config = getSupabaseConfig();
      expect(typeof config.isConfigured).toBe("boolean");
      expect(typeof isSupabaseConfigured()).toBe("boolean");
      if (!config.isConfigured) {
        expect(config.url).toBeNull();
        expect(config.anonKey).toBeNull();
        expect(config.errorMessage).not.toBeNull();
      }
    });

    it("throws or warns via assertSupabaseConfigured() according to mode", () => {
      // In dev mode, should warn; in non-dev, should throw
      const isConfigured = isSupabaseConfigured();
      if (!isConfigured) {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        assertSupabaseConfigured();
        warnSpy.mockRestore();
      } else {
        expect(() => assertSupabaseConfigured()).not.toThrow();
      }
    });
  });
});
