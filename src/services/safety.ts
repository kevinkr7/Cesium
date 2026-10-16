import { getSupabase } from "@/lib/supabase/client";

export async function blockUser(
  targetUserId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.user) return { success: false, error: "Must be signed in to block a user" };

  const { error } = await sb.from("blocked_users").insert({
    blocker_id: session.user.id,
    blocked_id: targetUserId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function unblockUser(
  targetUserId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.user) return { success: false, error: "Must be signed in to unblock a user" };

  const { error } = await sb
    .from("blocked_users")
    .delete()
    .eq("blocker_id", session.user.id)
    .eq("blocked_id", targetUserId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function reportUser(
  reportedUserId: string,
  reason: string,
  details: string = "",
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.user) return { success: false, error: "Must be signed in to report a user" };

  const { error } = await sb.from("user_reports").insert({
    reporter_id: session.user.id,
    reported_user_id: reportedUserId,
    reason: reason.trim(),
    details: details.trim(),
    status: "pending",
  });

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
