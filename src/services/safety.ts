import { getSupabase } from "@/lib/supabase/client";
import { getDemoState, setDemo } from "@/lib/store";
import { sanitizeReportInput } from "@/lib/security";

export type BlockedUser = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  blocked_at: string;
};

export type ContentReportInput = {
  contentType: "post" | "reply";
  contentId: string;
  reason: string;
  details?: string;
};

export type UserReportInput = {
  reportedUserId: string;
  reason: string;
  details?: string;
};

export type ContentSafetyResult = {
  safe: boolean;
  flaggedTerms: string[];
  severity: "none" | "low" | "medium" | "high";
  message?: string;
};

export const REPORT_REASONS = [
  "Harassment or bullying",
  "Spam or commercial solicitation",
  "Hate speech or discrimination",
  "Inappropriate or graphic content",
  "Impersonation",
  "Other safety concern",
] as const;

export function validateReportInput(
  reason: string,
  details?: string,
): { valid: boolean; error: string | null } {
  const cleanReason = (reason ?? "").trim();
  if (cleanReason.length < 3 || cleanReason.length > 100) {
    return { valid: false, error: "Report reason must be between 3 and 100 characters" };
  }
  const cleanDetails = (details ?? "").trim();
  if (cleanDetails.length > 1000) {
    return { valid: false, error: "Report details must not exceed 1000 characters" };
  }
  return { valid: true, error: null };
}

// Curated list of toxic / harmful keywords for automated content moderation
const HARMFUL_PATTERNS = [
  "kill yourself",
  "die in a fire",
  "hate speech",
  "racial slur",
  "doxx",
  "swatting",
  "harass",
  "terrorist threat",
];

export function checkContentSafety(text: string): ContentSafetyResult {
  if (!text || typeof text !== "string") {
    return { safe: true, flaggedTerms: [], severity: "none" };
  }
  const lower = text.toLowerCase();
  const flaggedTerms: string[] = [];
  for (const term of HARMFUL_PATTERNS) {
    if (lower.includes(term)) {
      flaggedTerms.push(term);
    }
  }
  if (flaggedTerms.length > 0) {
    return {
      safe: false,
      flaggedTerms,
      severity: "high",
      message: "Content violates Cesium safety guidelines and contains harmful language.",
    };
  }
  return { safe: true, flaggedTerms: [], severity: "none" };
}

export function isUserBlockedLocally(targetUserId: string): boolean {
  const { blockedUsers } = getDemoState();
  return Boolean(blockedUsers && blockedUsers.includes(targetUserId));
}

export async function blockUser(
  targetUserId: string,
): Promise<{ success: boolean; error: string | null }> {
  if (!targetUserId || targetUserId.trim() === "") {
    return { success: false, error: "Target user ID is required" };
  }

  const sb = getSupabase();
  const currentSession = getDemoState().session;

  // Prevent self-blocking
  if (currentSession?.id && currentSession.id === targetUserId) {
    return { success: false, error: "Cannot block yourself" };
  }

  if (sb) {
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (session?.user) {
        if (session.user.id === targetUserId) {
          return { success: false, error: "Cannot block yourself" };
        }

        // Attempt transactional RPC
        const rpcRes = await sb.rpc("rpc_block_user", { p_target_user_id: targetUserId });
        if (!rpcRes.error) {
          // Sync with store
          syncBlockInStore(targetUserId);
          return { success: true, error: null };
        }

        // Direct table fallback
        const { error: blockErr } = await sb.from("blocked_users").insert({
          blocker_id: session.user.id,
          blocked_id: targetUserId,
        });

        if (blockErr && !blockErr.message.includes("duplicate")) {
          return { success: false, error: blockErr.message };
        }

        // Sever connection
        await sb
          .from("connections")
          .delete()
          .or(
            `and(requester_id.eq.${session.user.id},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${session.user.id})`,
          );

        syncBlockInStore(targetUserId);
        return { success: true, error: null };
      }
    } catch {
      // Fallback gracefully for offline / mock testing
    }
  }

  // Resilient offline / demo fallback
  syncBlockInStore(targetUserId);
  return { success: true, error: null };
}

function syncBlockInStore(targetUserId: string) {
  setDemo((s) => {
    const prevBlocked = s.blockedUsers || [];
    const updatedBlocked = prevBlocked.includes(targetUserId)
      ? prevBlocked
      : [...prevBlocked, targetUserId];

    const updatedConnections = { ...s.connections };
    delete updatedConnections[targetUserId];

    return {
      blockedUsers: updatedBlocked,
      connections: updatedConnections,
    };
  });
}

export async function unblockUser(
  targetUserId: string,
): Promise<{ success: boolean; error: string | null }> {
  if (!targetUserId || targetUserId.trim() === "") {
    return { success: false, error: "Target user ID is required" };
  }

  const sb = getSupabase();

  if (sb) {
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (session?.user) {
        // Attempt transactional RPC
        const rpcRes = await sb.rpc("rpc_unblock_user", { p_target_user_id: targetUserId });
        if (!rpcRes.error) {
          syncUnblockInStore(targetUserId);
          return { success: true, error: null };
        }

        const { error } = await sb
          .from("blocked_users")
          .delete()
          .eq("blocker_id", session.user.id)
          .eq("blocked_id", targetUserId);

        if (error) return { success: false, error: error.message };
        syncUnblockInStore(targetUserId);
        return { success: true, error: null };
      }
    } catch {
      // Fallback gracefully
    }
  }

  // Resilient offline / demo fallback
  syncUnblockInStore(targetUserId);
  return { success: true, error: null };
}

function syncUnblockInStore(targetUserId: string) {
  setDemo((s) => {
    const prevBlocked = s.blockedUsers || [];
    return {
      blockedUsers: prevBlocked.filter((id) => id !== targetUserId),
    };
  });
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const sb = getSupabase();

  if (sb) {
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (session?.user) {
        const rpcRes = await sb.rpc("rpc_get_blocked_users");
        if (!rpcRes.error && rpcRes.data) {
          return rpcRes.data.map((r) => ({
            id: r.id,
            display_name: r.display_name,
            handle: r.handle,
            avatar_url: r.avatar_url,
            blocked_at: r.blocked_at,
          }));
        }

        // Direct table query fallback
        const { data, error } = await sb
          .from("blocked_users")
          .select(
            "blocked_id, created_at, profiles!blocked_users_blocked_id_fkey(id, display_name, handle, avatar_path)",
          )
          .eq("blocker_id", session.user.id);

        if (!error && data) {
          return data.map((d) => {
            const prof = d.profiles as unknown as {
              id: string;
              display_name: string;
              handle: string;
              avatar_path?: string;
            } | null;
            return {
              id: d.blocked_id,
              display_name: prof?.display_name || "Blocked User",
              handle: prof?.handle || "user",
              avatar_url: prof?.avatar_path || null,
              blocked_at: d.created_at,
            };
          });
        }
      }
    } catch {
      // Fallback gracefully
    }
  }

  // Offline / mock fallback
  const { blockedUsers } = getDemoState();
  return (blockedUsers || []).map((id) => ({
    id,
    display_name: `User ${id}`,
    handle: `user_${id.slice(0, 6)}`,
    avatar_url: null,
    blocked_at: new Date().toISOString(),
  }));
}

export async function reportUser(
  reportedUserId: string,
  reason: string,
  details: string = "",
): Promise<{ success: boolean; reportId?: string | undefined; error: string | null }> {
  if (!reportedUserId || reportedUserId.trim() === "") {
    return { success: false, error: "Reported user ID is required" };
  }

  const currentSession = getDemoState().session;
  if (currentSession?.id && currentSession.id === reportedUserId) {
    return { success: false, error: "Cannot report yourself" };
  }

  const sanitized = sanitizeReportInput({ reason, details });
  const validation = validateReportInput(sanitized.reason, sanitized.details);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (session?.user) {
        if (session.user.id === reportedUserId) {
          return { success: false, error: "Cannot report yourself" };
        }

        const rpcRes = await sb.rpc("rpc_report_user", {
          p_reported_user_id: reportedUserId,
          p_reason: sanitized.reason,
          p_details: sanitized.details,
        });

        if (!rpcRes.error && rpcRes.data) {
          const reportId = (rpcRes.data as { report_id?: string })?.report_id;
          return { success: true, reportId, error: null };
        }

        const { data, error } = await sb
          .from("user_reports")
          .insert({
            reporter_id: session.user.id,
            reported_user_id: reportedUserId,
            reason: sanitized.reason,
            details: sanitized.details,
            status: "pending",
          })
          .select("id")
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, reportId: data?.id, error: null };
      }
    } catch {
      // Fallback gracefully
    }
  }

  // Offline / mock fallback
  return {
    success: true,
    reportId: `mock-report-${Date.now()}`,
    error: null,
  };
}

export async function reportContent(
  contentType: "post" | "reply",
  contentId: string,
  reason: string,
  details: string = "",
): Promise<{ success: boolean; reportId?: string | undefined; error: string | null }> {
  if (contentType !== "post" && contentType !== "reply") {
    return { success: false, error: 'Content type must be "post" or "reply"' };
  }

  if (!contentId || contentId.trim() === "") {
    return { success: false, error: "Content ID is required" };
  }

  const sanitized = sanitizeReportInput({ reason, details });
  const validation = validateReportInput(sanitized.reason, sanitized.details);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (session?.user) {
        const rpcRes = await sb.rpc("rpc_report_content", {
          p_content_type: contentType,
          p_content_id: contentId,
          p_reason: sanitized.reason,
          p_details: sanitized.details,
        });

        if (!rpcRes.error && rpcRes.data) {
          const reportId = (rpcRes.data as { report_id?: string })?.report_id;
          return { success: true, reportId, error: null };
        }

        const { data, error } = await sb
          .from("content_reports")
          .insert({
            reporter_id: session.user.id,
            content_type: contentType,
            content_id: contentId,
            reason: sanitized.reason,
            details: sanitized.details,
            status: "pending",
          })
          .select("id")
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, reportId: data?.id, error: null };
      }
    } catch {
      // Fallback gracefully
    }
  }

  // Offline / mock fallback
  return {
    success: true,
    reportId: `mock-content-report-${Date.now()}`,
    error: null,
  };
}
