import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "We'd love something to call you")
      .max(60, "Keep it under 60 characters"),
    email: z.string().trim().email("That email doesn't look quite right"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords don't match yet",
    path: ["confirm"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("That email doesn't look quite right"),
  password: z.string().min(1, "Password is required"),
});

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  handle?: string;
};

export async function signUpUser(data: { name: string; email: string; password: string }) {
  const sb = getSupabase();
  if (!sb) {
    // Local development mode when Supabase credentials are not yet configured
    const user: AuthUser = {
      id: "local-" + Math.random().toString(36).slice(2, 10),
      email: data.email,
      displayName: data.name.trim(),
      handle:
        "@" +
        data.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, ""),
    };
    return { user, error: null };
  }

  const { data: authData, error } = await sb.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        display_name: data.name.trim(),
      },
    },
  });

  if (error) return { user: null, error: error.message };

  const sbUser = authData.user;
  if (!sbUser) return { user: null, error: "Failed to create user account" };

  const user: AuthUser = {
    id: sbUser.id,
    email: sbUser.email ?? data.email,
    displayName: (sbUser.user_metadata?.["display_name"] as string) || data.name.trim(),
  };

  return { user, error: null };
}

export async function signInUser(data: { email: string; password: string }) {
  const sb = getSupabase();
  if (!sb) {
    const user: AuthUser = {
      id: "local-" + Math.random().toString(36).slice(2, 10),
      email: data.email,
      displayName: data.email.split("@")[0] ?? "friend",
      handle: "@" + (data.email.split("@")[0] ?? "friend").toLowerCase(),
    };
    return { user, error: null };
  }

  const { data: authData, error } = await sb.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) return { user: null, error: error.message };

  const sbUser = authData.user;
  if (!sbUser) return { user: null, error: "Authentication failed" };

  const user: AuthUser = {
    id: sbUser.id,
    email: sbUser.email ?? data.email,
    displayName:
      (sbUser.user_metadata?.["display_name"] as string) ||
      (sbUser.email?.split("@")[0] ?? "Friend"),
  };

  return { user, error: null };
}

export async function signOutUser() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
}

export async function resetPasswordForEmail(email: string) {
  const sb = getSupabase();
  if (!sb) {
    return { success: true, message: "Password reset instructions sent (local mode)." };
  }

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login?mode=reset`,
  });

  if (error) return { success: false, message: error.message };
  return { success: true, message: "Check your inbox for password reset instructions." };
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.user) return null;

  const u = session.user;
  return {
    id: u.id,
    email: u.email ?? "",
    displayName:
      (u.user_metadata?.["display_name"] as string) || (u.email?.split("@")[0] ?? "Friend"),
  };
}
