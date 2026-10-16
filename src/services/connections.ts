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

export async function sendConnectionRequest(
  targetUserId: string,
): Promise<{ success: boolean; status: ConnectionStatus; error: string | null }> {
  const sb = getSupabase();
  if (!sb) {
    return { success: true, status: "pending", error: null };
  }

  const { data, error } = await sb.rpc("rpc_send_connection_request", {
    p_target_user_id: targetUserId,
  });

  if (error) return { success: false, status: "none", error: error.message };
  return {
    success: data.success,
    status: (data.status as ConnectionStatus) ?? "pending",
    error: null,
  };
}

export async function respondToConnectionRequest(
  connectionId: string,
  newStatus: "accepted" | "declined",
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) {
    return { success: true, error: null };
  }

  const { data, error } = await sb.rpc("rpc_respond_to_connection_request", {
    p_connection_id: connectionId,
    p_status: newStatus,
  });

  if (error) return { success: false, error: error.message };
  return { success: Boolean(data?.success), error: null };
}

export async function cancelConnectionRequest(
  connectionId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const { error } = await sb
    .from("connections")
    .update({ status: "canceled" })
    .eq("id", connectionId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function removeConnection(
  connectionId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const { error } = await sb
    .from("connections")
    .update({ status: "removed" })
    .eq("id", connectionId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function fetchConnections(
  currentUserId: string,
): Promise<Record<string, "pending" | "connected">> {
  const sb = getSupabase();
  if (!sb) return {};

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
}
