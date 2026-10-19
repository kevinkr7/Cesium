import { getSupabase } from "@/lib/supabase/client";

export type NotificationType =
  "connection_request" | "connection_accepted" | "new_message" | "community_reply";

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  sender?:
    | {
        id: string;
        name: string;
        handle: string;
        avatar?: string | undefined;
      }
    | undefined;
};

/**
 * Fetch all unread or recent notifications for a user
 */
export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const sb = getSupabase();
  if (!sb || userId === "demo" || userId.startsWith("demo-")) {
    return [];
  }

  try {
    const { data, error } = await sb
      .from("notifications")
      .select("id, user_id, type, title, payload, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) return [];

    const notifications: AppNotification[] = [];

    // Collect sender profile IDs to fetch display info in batch
    const senderIds = new Set<string>();
    for (const n of data) {
      const payload = (n.payload as Record<string, unknown>) || {};
      const sid =
        (payload["requester_id"] as string | undefined) ||
        (payload["sender_id"] as string | undefined) ||
        (payload["addressee_id"] as string | undefined);
      if (sid) senderIds.add(sid);
    }

    const profilesMap = new Map<
      string,
      { name: string; handle: string; avatar?: string | undefined }
    >();
    if (senderIds.size > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, display_name, handle, avatar_path")
        .in("id", Array.from(senderIds));

      if (profiles) {
        for (const p of profiles) {
          profilesMap.set(p.id, {
            name: p.display_name,
            handle: p.handle,
            avatar: p.avatar_path ?? undefined,
          });
        }
      }
    }

    for (const n of data) {
      const payload = (n.payload as Record<string, unknown>) || {};
      const sid =
        (payload["requester_id"] as string | undefined) ||
        (payload["sender_id"] as string | undefined) ||
        (payload["addressee_id"] as string | undefined);
      const senderProfile = sid ? profilesMap.get(sid) : undefined;

      notifications.push({
        id: n.id,
        userId: n.user_id,
        type: n.type as NotificationType,
        title: n.title,
        payload,
        isRead: Boolean(n.read),
        createdAt: n.created_at,
        sender:
          senderProfile && sid
            ? {
                id: sid,
                name: senderProfile.name,
                handle: senderProfile.handle,
                avatar: senderProfile.avatar,
              }
            : undefined,
      });
    }

    return notifications;
  } catch {
    return [];
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || notificationId.startsWith("demo-")) return true;

  try {
    const { error } = await sb
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || userId === "demo") return true;

  try {
    const { error } = await sb
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Subscribes to real-time notification events and incoming connection requests
 */
export function subscribeToRealtimeNotifications(
  userId: string,
  onNotification: (notif: AppNotification) => void,
  onConnectionChange?: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb || userId === "demo" || userId.startsWith("demo-")) {
    return () => {};
  }

  const channel = sb
    .channel(`user-alerts:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = payload.new as any;
        const p = (n.payload as Record<string, unknown>) || {};
        const sid =
          (p["requester_id"] as string | undefined) || (p["sender_id"] as string | undefined);

        let senderInfo = undefined;
        if (sid) {
          const { data: profile } = await sb
            .from("profiles")
            .select("id, display_name, handle, avatar_path")
            .eq("id", sid)
            .maybeSingle();

          if (profile) {
            senderInfo = {
              id: profile.id,
              name: profile.display_name,
              handle: profile.handle,
              avatar: profile.avatar_path ?? undefined,
            };
          }
        }

        onNotification({
          id: n.id,
          userId: n.user_id,
          type: n.type as NotificationType,
          title: n.title,
          payload: p,
          isRead: false,
          createdAt: n.created_at,
          sender: senderInfo,
        });

        if (onConnectionChange) {
          onConnectionChange();
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "connections",
        filter: `addressee_id=eq.${userId}`,
      },
      () => {
        if (onConnectionChange) {
          onConnectionChange();
        }
      },
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}
