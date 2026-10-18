import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb.from("profiles").select("*").eq("id", userId).single();

  if (error || !data) return null;
  return data;
}

export async function isHandleAvailable(handle: string, currentUserId?: string): Promise<boolean> {
  const rawClean = handle.replace(/^@/, "").trim().toLowerCase();
  if (rawClean.length < 2 || rawClean.length > 30) return false;

  const cleanHandle = sanitizeHandle(handle);

  const sb = getSupabase();
  if (!sb) return true;

  try {
    let query = sb.from("profiles").select("id").eq("handle", cleanHandle);
    if (currentUserId) {
      query = query.neq("id", currentUserId);
    }
    const timeoutPromise = new Promise<{ data: null; error: null }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: null }), 1500),
    );
    const result = await Promise.race([query.maybeSingle(), timeoutPromise]);
    return !result.data;
  } catch (err) {
    void err;
    return true;
  }
}

import {
  sanitizeHandle,
  validateHandle,
  sanitizeDisplayName,
  sanitizeBio,
  sanitizeCity,
} from "@/lib/security";

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateProfileUpdates(updates: {
  display_name?: string | null | undefined;
  handle?: string | null | undefined;
  bio?: string | null | undefined;
  city?: string | null | undefined;
}): { valid: boolean; error: string | null } {
  if (updates.display_name !== undefined && updates.display_name !== null) {
    const rawTrim = updates.display_name.trim();
    if (!rawTrim || rawTrim.length > 60) {
      return { valid: false, error: "Display name must be between 1 and 60 characters." };
    }
  }

  if (updates.handle !== undefined && updates.handle !== null) {
    const handleResult = validateHandle(updates.handle);
    if (!handleResult.valid) {
      return {
        valid: false,
        error: handleResult.error,
      };
    }
  }

  if (updates.bio !== undefined && updates.bio !== null && updates.bio.length > 240) {
    return { valid: false, error: "Bio cannot exceed 240 characters." };
  }

  if (updates.city !== undefined && updates.city !== null && updates.city.length > 80) {
    return { valid: false, error: "City cannot exceed 80 characters." };
  }

  return { valid: true, error: null };
}

export async function updateProfile(
  userId: string,
  updates: Partial<
    Omit<Database["public"]["Tables"]["profiles"]["Update"], "id" | "created_at" | "updated_at">
  >,
): Promise<{ success: boolean; error: string | null }> {
  const validation = validateProfileUpdates({
    display_name: updates.display_name ?? undefined,
    handle: updates.handle ?? undefined,
    bio: updates.bio ?? undefined,
    city: updates.city ?? undefined,
  });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const sb = getSupabase();
  if (!sb) {
    return { success: true, error: null };
  }

  const cleanUpdates = { ...updates };
  if (cleanUpdates.handle) {
    cleanUpdates.handle = sanitizeHandle(cleanUpdates.handle);
  }
  if (cleanUpdates.display_name) {
    cleanUpdates.display_name = sanitizeDisplayName(cleanUpdates.display_name);
  }
  if (cleanUpdates.bio) {
    cleanUpdates.bio = sanitizeBio(cleanUpdates.bio);
  }
  if (cleanUpdates.city) {
    cleanUpdates.city = sanitizeCity(cleanUpdates.city);
  }

  const { error } = await sb
    .from("profiles")
    .update({
      ...cleanUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
    return {
      url: null,
      error: "Invalid image format. Supported formats: JPEG, PNG, WebP.",
    };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      url: null,
      error: "Image size exceeds 5MB limit.",
    };
  }

  const sb = getSupabase();
  if (!sb) return { url: null, error: "Supabase storage not configured" };

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filePath = `avatars/${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("public_assets")
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data: urlData } = sb.storage.from("public_assets").getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;

  await updateProfile(userId, { avatar_path: publicUrl });
  return { url: publicUrl, error: null };
}

export async function deleteUserAccount(
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  // Cascade delete user interests
  await sb.from("user_interests").delete().eq("user_id", userId);

  const { error } = await sb.from("profiles").delete().eq("id", userId);
  if (error) return { success: false, error: error.message };

  await sb.auth.signOut();
  return { success: true, error: null };
}
