import { z } from "zod";

/**
 * CESIUM ENVIRONMENT CONFIGURATION & VALIDATION (Phase 1)
 *
 * Strict validation of Supabase credentials and runtime environment flags.
 * Follows the Cesium Production Engineering Contract:
 * - Public anon key only — server secrets / service role keys must NEVER be exposed to browser code.
 * - Explicitly detects configured vs unconfigured states without crashing in development.
 * - Rejects dummy/placeholder URLs and keys.
 */

const PLACEHOLDER_URL = "your-project.supabase.co";
const PLACEHOLDER_KEY = "your-anon-key-here";

export const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .trim()
    .url(
      "VITE_SUPABASE_URL must be a valid URL (e.g. https://xyz.supabase.co or http://127.0.0.1:54321)",
    )
    .refine((url) => !url.includes(PLACEHOLDER_URL), {
      message:
        "VITE_SUPABASE_URL is set to default placeholder 'your-project.supabase.co'. Please set your actual Supabase URL.",
    }),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(20, "VITE_SUPABASE_ANON_KEY must be a valid JWT or anon token (minimum 20 characters)")
    .refine((key) => !key.includes(PLACEHOLDER_KEY), {
      message:
        "VITE_SUPABASE_ANON_KEY is set to default placeholder. Please set your actual Supabase Anon Key.",
    }),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export type SupabaseConfig = {
  url: string | null;
  anonKey: string | null;
  isConfigured: boolean;
  isOfflineDev: boolean;
  errorMessage: string | null;
};

/**
 * Validates raw environment dictionary against the schema.
 */
export function validateEnv(
  rawEnv: Record<string, unknown> = typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : {},
): { success: boolean; data: ValidatedEnv | null; errors: string[] } {
  const parseResult = envSchema.safeParse({
    VITE_SUPABASE_URL: rawEnv["VITE_SUPABASE_URL"],
    VITE_SUPABASE_ANON_KEY: rawEnv["VITE_SUPABASE_ANON_KEY"],
  });

  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`,
    );
    return {
      success: false,
      data: null,
      errors: errorMessages,
    };
  }

  return {
    success: true,
    data: parseResult.data,
    errors: [],
  };
}

/**
 * Resolves current Supabase configuration.
 * Returns null url/key with isConfigured=false when running without valid backend.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env["DEV"]);
  const validation = validateEnv();

  if (validation.success && validation.data) {
    return {
      url: validation.data.VITE_SUPABASE_URL,
      anonKey: validation.data.VITE_SUPABASE_ANON_KEY,
      isConfigured: true,
      isOfflineDev: false,
      errorMessage: null,
    };
  }

  const errorSummary = validation.errors.join("; ");
  return {
    url: null,
    anonKey: null,
    isConfigured: false,
    isOfflineDev: isDev,
    errorMessage: errorSummary || "Supabase environment variables are missing or unconfigured.",
  };
}

/**
 * Quick boolean check for whether Supabase is configured with valid credentials.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

/**
 * Asserts that Supabase is configured. Throws in production environments.
 */
export function assertSupabaseConfigured(): void {
  const cfg = getSupabaseConfig();
  if (!cfg.isConfigured) {
    const msg = `[Cesium Engine Error] Supabase is unconfigured: ${cfg.errorMessage}`;
    if (!cfg.isOfflineDev) {
      throw new Error(msg);
    } else {
      console.warn(`${msg} Running in offline mock development mode.`);
    }
  }
}
