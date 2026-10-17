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
  const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
  if (cleanHandle.length < 2 || cleanHandle.length > 30) return false;

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

export async function updateProfile(
  userId: string,
  updates: Partial<
    Omit<Database["public"]["Tables"]["profiles"]["Update"], "id" | "created_at" | "updated_at">
  >,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) {
    return { success: true, error: null };
  }

  const { error } = await sb
    .from("profiles")
    .update({
      ...updates,
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
  const sb = getSupabase();
  if (!sb) return { url: null, error: "Supabase storage not configured" };

  const ext = file.name.split(".").pop();
  const filePath = `avatars/${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("public_assets")
    .upload(filePath, file, { upsert: true });

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

  const { error } = await sb.from("profiles").delete().eq("id", userId);
  if (error) return { success: false, error: error.message };

  await sb.auth.signOut();
  return { success: true, error: null };
}
