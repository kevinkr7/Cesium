import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseConfig, isSupabaseConfigured as checkConfigured } from "@/lib/env";

/**
 * CESIUM SUPABASE CLIENT (Phase 1)
 *
 * Typesafe singleton Supabase client with health-check and SSR-safe configuration.
 */

export const isSupabaseConfigured: boolean = checkConfigured();

let clientInstance: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.anonKey) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient<Database>(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

export const supabase: SupabaseClient<Database> | null = getSupabase();

export type SupabaseHealthResult = {
  ok: boolean;
  message: string;
  latencyMs: number;
};

/**
 * Health check ping to verify database connectivity.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  const sb = getSupabase();
  if (!sb) {
    return {
      ok: false,
      message: "Supabase client is not configured (missing URL or Anon Key).",
      latencyMs: 0,
    };
  }

  const start = performance.now();
  try {
    // Lightweight check against public interests count or auth session
    const { error } = await sb
      .from("interests")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      return {
        ok: false,
        message: `Database error: ${error.message}`,
        latencyMs,
      };
    }

    return {
      ok: true,
      message: "Connected to Supabase PostgreSQL.",
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Connection failed: ${msg}`,
      latencyMs,
    };
  }
}
