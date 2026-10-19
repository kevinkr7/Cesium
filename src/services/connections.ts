import { getSupabase } from "@/lib/supabase/client";

export type ConnectionStatus =
  "none" | "pending" | "accepted" | "declined" | "canceled" | "removed";

export type ConnectionRecord = {
  id: string;
  targetUserId: string;
  status: ConnectionStatus;
  isRequester: boolean;
  createdAt: string;
};

export type PendingConnectionRequest = {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  userAvatar?: string | undefined;
  userCity: string;
  interests: string[];
  createdAt: string;
  direction: "incoming" | "outgoing";
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(str: string | undefined | null): boolean {
  return !!str && UUID_REGEX.test(str);
}

async function withTimeout<T>(promise: PromiseLike<T>, ms = 1500): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Send a connection request to another user
 */
export async function sendConnectionRequest(
  targetUserId: string,
  currentUserId?: string,
): Promise<{ success: boolean; status: ConnectionStatus; error: string | null }> {
  if (currentUserId && targetUserId === currentUserId) {
    return { success: false, status: "none", error: "Cannot connect to self" };
  }

  const sb = getSupabase();
  if (
    !sb ||
    !isUuid(targetUserId) ||
    targetUserId.startsWith("demo-") ||
    currentUserId === "demo"
  ) {
    return { success: true, status: "pending", error: null };
  }

  try {
    const effectiveUserId = currentUserId || (await sb.auth.getSession()).data.session?.user?.id;
    if (effectiveUserId && targetUserId === effectiveUserId) {
      return { success: false, status: "none", error: "Cannot connect to self" };
    }

    const res = await withTimeout(
      sb.rpc("rpc_send_connection_request", {
        p_target_user_id: targetUserId,
      }),
      5000,
    );

    if (res && !res.error && res.data) {
      const data = res.data as { success?: boolean; status?: string } | null;
      if (data?.success) {
        return {
          success: true,
          status: (data.status as ConnectionStatus) ?? "pending",
          error: null,
        };
      }
    }

    // Resilient fallback: direct table insert/upsert if RPC is unmigrated or errored
    if (effectiveUserId && isUuid(effectiveUserId) && isUuid(targetUserId)) {
      const { data: existingConn } = await sb
        .from("connections")
        .select("id, status")
        .or(
          `and(requester_id.eq.${effectiveUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${effectiveUserId})`,
        )
        .maybeSingle();

      let connId = existingConn?.id;
      if (existingConn) {
        if (existingConn.status === "accepted") {
          return { success: true, status: "accepted", error: null };
        }
        await sb
          .from("connections")
          .update({ requester_id: effectiveUserId, addressee_id: targetUserId, status: "pending" })
          .eq("id", existingConn.id);
      } else {
        const { data: newConn, error: insertErr } = await sb
          .from("connections")
          .insert({
            requester_id: effectiveUserId,
            addressee_id: targetUserId,
            status: "pending",
          })
          .select("id")
          .single();

        if (insertErr) {
          return { success: false, status: "none", error: insertErr.message };
        }
        connId = newConn?.id;
      }

      // Also ensure realtime alert notification is recorded for addressee
      await sb.from("notifications").insert({
        user_id: targetUserId,
        type: "connection_request",
        title: "New connection request",
        payload: { requester_id: effectiveUserId, connection_id: connId },
        read: false,
      });

      return { success: true, status: "pending", error: null };
    }

    if (res?.error) {
      return { success: false, status: "none", error: res.error.message };
    }
    return { success: true, status: "pending", error: null };
  } catch (err) {
    return {
      success: false,
      status: "none",
      error: err instanceof Error ? err.message : "Failed to send request",
    };
  }
}

/**
 * Accept or decline an incoming connection request
 */
export async function respondToConnectionRequest(
  connectionIdOrUserId: string,
  newStatus: "accepted" | "declined",
  currentUserId?: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (
    !sb ||
    !isUuid(connectionIdOrUserId) ||
    connectionIdOrUserId.startsWith("demo-") ||
    currentUserId === "demo"
  ) {
    return { success: true, error: null };
  }

  try {
    let connectionId = connectionIdOrUserId;
    const effectiveUserId = currentUserId || (await sb.auth.getSession()).data.session?.user?.id;

    if (effectiveUserId) {
      const { data: found } = await sb
        .from("connections")
        .select("id")
        .or(
          `and(requester_id.eq.${connectionIdOrUserId},addressee_id.eq.${effectiveUserId}),and(requester_id.eq.${effectiveUserId},addressee_id.eq.${connectionIdOrUserId})`,
        )
        .eq("status", "pending")
        .maybeSingle();

      if (found?.id) {
        connectionId = found.id;
      }
    }

    const res = await withTimeout(
      sb.rpc("rpc_respond_to_connection_request", {
        p_connection_id: connectionId,
        p_status: newStatus,
      }),
      5000,
    );

    if (res && !res.error && (res.data as { success?: boolean } | null)?.success) {
      return { success: true, error: null };
    }

    // Direct table fallback: update connection row directly
    const { error: updErr } = await sb
      .from("connections")
      .update({ status: newStatus })
      .eq("id", connectionId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    if (newStatus === "accepted" && effectiveUserId) {
      const { data: conn } = await sb
        .from("connections")
        .select("requester_id, addressee_id")
        .eq("id", connectionId)
        .maybeSingle();

      if (conn) {
        const otherId =
          conn.requester_id === effectiveUserId ? conn.addressee_id : conn.requester_id;
        await sb.from("notifications").insert({
          user_id: otherId,
          type: "connection_accepted",
          title: "Connection accepted",
          payload: { responder_id: effectiveUserId, connection_id: connectionId },
          read: false,
        });
      }
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to respond to request",
    };
  }
}

/**
 * Cancel an outgoing pending connection request
 */
export async function cancelConnectionRequest(
  connectionIdOrUserId: string,
  currentUserId?: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (
    !sb ||
    !isUuid(connectionIdOrUserId) ||
    connectionIdOrUserId.startsWith("demo-") ||
    currentUserId === "demo"
  ) {
    return { success: true, error: null };
  }

  try {
    const effectiveUserId = currentUserId || (await sb.auth.getSession()).data.session?.user?.id;

    let query = sb.from("connections").update({ status: "canceled" });
    if (effectiveUserId) {
      query = query.or(
        `id.eq.${connectionIdOrUserId},and(requester_id.eq.${effectiveUserId},addressee_id.eq.${connectionIdOrUserId})`,
      );
    } else {
      query = query.eq("id", connectionIdOrUserId);
    }

    const { error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel request",
    };
  }
}

/**
 * Remove an existing accepted connection
 */
export async function removeConnection(
  connectionIdOrUserId: string,
  currentUserId?: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (
    !sb ||
    !isUuid(connectionIdOrUserId) ||
    connectionIdOrUserId.startsWith("demo-") ||
    currentUserId === "demo"
  ) {
    return { success: true, error: null };
  }

  try {
    const effectiveUserId = currentUserId || (await sb.auth.getSession()).data.session?.user?.id;

    let query = sb.from("connections").update({ status: "removed" });
    if (effectiveUserId) {
      query = query
        .or(
          `id.eq.${connectionIdOrUserId},and(requester_id.eq.${effectiveUserId},addressee_id.eq.${connectionIdOrUserId}),and(requester_id.eq.${connectionIdOrUserId},addressee_id.eq.${effectiveUserId})`,
        )
        .eq("status", "accepted");
    } else {
      query = query.eq("id", connectionIdOrUserId);
    }

    const { error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove connection",
    };
  }
}

/**
 * Fetch all connections map for a given user
 */
export async function fetchConnections(
  currentUserId: string,
): Promise<Record<string, "pending" | "connected">> {
  const sb = getSupabase();
  if (!sb || currentUserId === "demo" || !isUuid(currentUserId)) return {};

  try {
    const { data, error } = await sb
      .from("connections")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
      .in("status", ["pending", "accepted"]);

    if (error || !data) return {};

    const result: Record<string, "pending" | "connected"> = {};
    for (const c of data) {
      const otherId = c.requester_id === currentUserId ? c.addressee_id : c.requester_id;
      if (c.status === "accepted") {
        result[otherId] = "connected";
      } else if (c.status === "pending") {
        result[otherId] = "pending";
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Fetch pending connection requests (both incoming and outgoing)
 */
export async function fetchPendingRequests(
  currentUserId: string,
): Promise<{ incoming: PendingConnectionRequest[]; outgoing: PendingConnectionRequest[] }> {
  const sb = getSupabase();
  if (!sb || currentUserId === "demo" || !isUuid(currentUserId)) {
    return { incoming: [], outgoing: [] };
  }

  try {
    const { data, error } = await sb
      .from("connections")
      .select("id, requester_id, addressee_id, created_at, status")
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
      .eq("status", "pending");

    if (error || !data) return { incoming: [], outgoing: [] };

    const incoming: PendingConnectionRequest[] = [];
    const outgoing: PendingConnectionRequest[] = [];

    for (const r of data) {
      const isIncoming = r.addressee_id === currentUserId;
      const otherId = isIncoming ? r.requester_id : r.addressee_id;

      let profile: {
        id: string;
        display_name: string;
        handle: string;
        city?: string | null;
        avatar_path?: string | null;
      } | null = null;

      if (isUuid(otherId)) {
        const { data: p } = await sb
          .from("profiles")
          .select("id, display_name, handle, city, avatar_path")
          .eq("id", otherId)
          .maybeSingle();
        profile = p;
      }

      const item: PendingConnectionRequest = {
        id: r.id,
        userId: otherId,
        userName: profile?.display_name ?? "Explorer",
        userHandle: profile?.handle ?? otherId.slice(0, 8),
        userAvatar: profile?.avatar_path ?? undefined,
        userCity: profile?.city ?? "Worldwide",
        interests: [],
        createdAt: r.created_at,
        direction: isIncoming ? "incoming" : "outgoing",
      };

      if (isIncoming) {
        incoming.push(item);
      } else {
        outgoing.push(item);
      }
    }

    return { incoming, outgoing };
  } catch {
    return { incoming: [], outgoing: [] };
  }
}

/**
 * Verify whether private messaging is unlocked between two users
 */
export function canInitiateConversation(
  connectionsRecord: Record<string, "pending" | "connected">,
  targetUserId: string,
): boolean {
  return connectionsRecord[targetUserId] === "connected";
}
