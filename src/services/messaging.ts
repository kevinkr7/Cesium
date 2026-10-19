import { getSupabase } from "@/lib/supabase/client";
import { sanitizeMessageBody } from "@/lib/security";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(str: string | undefined | null): boolean {
  return !!str && UUID_REGEX.test(str);
}

export type RealtimeMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  from: "me" | "them";
  text: string;
  at: number;
  status?: "sending" | "sent" | "error";
};

export type IcebreakerOptions = {
  bridges?: Array<{ from: string; to: string; explanation?: string }>;
  uncommonAnchor?: string;
  count?: number;
};

/**
 * Break the Ice: deterministic starter templates generated from actual shared interests
 */
export const ICEBREAKER_TEMPLATES: Record<string, string> = {
  "Film photography": "What's the best mistake you ever made on a roll of film?",
  "Zine making": "If you had 8 pages and 24 hours to photocopy anything, what's on the cover?",
  Letterpress: "What's the most tactile piece of printed paper you've held?",
  Ceramics: "Do you prefer the wheel or pinching by hand? What's the last vessel you made?",
  Typography: "What's a font that makes you irrationally happy when spotted in the wild?",
  "Creative coding": "What's the strangest visual bug you turned into an intentional aesthetic?",
  "Mechanical keyboards":
    "Clicky, tactile, or silent linear? What sound profile gives you flow state?",
  "Retro computing": "Which legacy machine or operating system do you still feel nostalgic for?",
  "Home automation": "What's the most delightfully unnecessary automation you've configured?",
  "Ambient music": "Which ambient album would you bring to an empty observatory at 2 AM?",
  Synthesizers: "What was the patch that made you realize modular was a point of no return?",
  "Music theory": "What chord progression or interval always gives you immediate chills?",
  "Field recording": "What's the rarest sound you've managed to capture on a microphone?",
  Astronomy: "If you could view any deep space phenomenon with your naked eye, which would it be?",
  Mycology: "What's the most uncanny mushroom specimen you've ever spotted on a trail?",
  Linguistics: "What untranslatable word from another language do you wish existed in English?",
  "Deep sea biology": "Which hydrothermal vent creature looks most like an alien to you?",
  "Indie cinema": "Which film ending changed how you viewed your own life for a week after?",
  "Translated fiction":
    "Which translated book felt like discovering a completely different dimension of thought?",
  "Brutalist architecture":
    "What's your favorite raw concrete building that other people call an eyesore?",
  "Urban walking": "What's the best hidden alleyway or overlooked landmark you've stumbled into?",
  "Indie games": "Which indie game made you stop playing just to listen to the atmosphere?",
  Speedrunning: "What level or route optimization took you the longest to master?",
  "Tabletop RPGs":
    "What's the most memorable character death or plot twist your table lived through?",
  "Puzzle design": "What's the most elegant 'aha' moment a puzzle game has ever given you?",
  "Abandoned railways":
    "What abandoned track or ghost station do you wish trains still ran through?",
  "Fonts on old signage":
    "Have you ever photographed a ghost sign just before it got painted over?",
  "Weather maps": "Do you track storm radars just to watch the front move across the coast?",
  "01:43 AM ideas":
    "What's a 2 AM idea you scribbled down that actually turned out to be brilliant?",
};

export const ICEBREAKER_FALLBACKS = [
  "What's one project you'd build if nobody could judge it?",
  "What's the most interesting rabbit hole you've fallen into lately?",
  "What's something you're learning right now that feels quietly profound?",
  "What's a discovery you made this year that completely altered your perspective?",
  "If you had an uninterrupted weekend to focus on one craft, where would you begin?",
];

/**
 * Generates tailored icebreaker conversation starters based on shared interests,
 * cross-domain bridges, and uncommon ground perspective anchors.
 */
export function getIcebreakerStarters(
  sharedInterests: string[],
  options?: IcebreakerOptions,
): string[] {
  const targetCount = options?.count ?? 3;
  const starters: string[] = [];

  // Helper for case-insensitive interest matching
  const findTemplate = (name: string): string | undefined => {
    if (ICEBREAKER_TEMPLATES[name]) return ICEBREAKER_TEMPLATES[name];
    const lower = name.trim().toLowerCase();
    const entry = Object.entries(ICEBREAKER_TEMPLATES).find(([k]) => k.toLowerCase() === lower);
    return entry ? entry[1] : undefined;
  };

  // 1. Direct shared interest templates
  for (const interest of sharedInterests) {
    const tmpl = findTemplate(interest);
    if (tmpl && !starters.includes(tmpl)) {
      starters.push(tmpl);
    }
  }

  // 2. Cross-domain bridges if provided
  if (options?.bridges && options.bridges.length > 0) {
    for (const bridge of options.bridges) {
      if (starters.length >= targetCount) break;
      const bridgePrompt = `Bridging your world of ${bridge.from} with their interest in ${bridge.to}: what unexpected connection do you see between them?`;
      if (!starters.includes(bridgePrompt)) {
        starters.push(bridgePrompt);
      }
    }
  }

  // 3. Uncommon ground anchor prompt if provided
  if (options?.uncommonAnchor && starters.length < targetCount) {
    const anchorPrompt = `Starting from your shared curiosity in ${options.uncommonAnchor}: what rabbit hole did they introduce you to?`;
    if (!starters.includes(anchorPrompt)) {
      starters.push(anchorPrompt);
    }
  }

  // 4. Fallbacks if fewer than targetCount starters exist
  for (const fb of ICEBREAKER_FALLBACKS) {
    if (starters.length < targetCount && !starters.includes(fb)) {
      starters.push(fb);
    }
  }

  return starters.slice(0, targetCount);
}

/**
 * Message body validation helper: 1 to 5000 chars after sanitization
 */
export function validateMessageBody(body: string): { valid: boolean; error: string | null } {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Message body cannot be empty" };
  }
  if (trimmed.length > 5000) {
    return { valid: false, error: "Message cannot exceed 5000 characters" };
  }
  const clean = sanitizeMessageBody(body);
  if (clean.length === 0) {
    return { valid: false, error: "Message body cannot be empty" };
  }
  return { valid: true, error: null };
}

/**
 * Resolves or creates the bilateral conversation between the authenticated user and a peer.
 */
export async function getOrCreateDirectConversation(
  peerUserId: string,
): Promise<{ conversationId: string | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) {
    // Deterministic mock/demo fallback ID
    return { conversationId: `conv-${peerUserId}`, error: null };
  }

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    // If unauthenticated or peer is mock/demo identifier, return deterministic conversation ID
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(peerUserId);
    if (!user || !isUuid) {
      return { conversationId: `conv-${peerUserId}`, error: null };
    }

    const { data, error } = await sb.rpc("rpc_get_or_create_direct_conversation", {
      p_peer_user_id: peerUserId,
    });

    if (error) {
      // Direct query fallback in case RPC is not yet deployed
      const { data: convMembers } = await sb
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (convMembers && convMembers.length > 0) {
        const convIds = convMembers.map((cm) => cm.conversation_id);
        const { data: peerMember } = await sb
          .from("conversation_members")
          .select("conversation_id")
          .in("conversation_id", convIds)
          .eq("user_id", peerUserId)
          .limit(1)
          .maybeSingle();

        if (peerMember) {
          return { conversationId: peerMember.conversation_id, error: null };
        }
      }

      return { conversationId: `conv-${peerUserId}`, error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convId = (data as any)?.conversation_id;
    return { conversationId: convId ?? `conv-${peerUserId}`, error: null };
  } catch (err) {
    return {
      conversationId: `conv-${peerUserId}`,
      error: err instanceof Error ? err.message : null,
    };
  }
}

/**
 * Fetches chronologically ordered conversation messages
 */
export async function fetchConversationMessages(
  conversationId: string,
  currentUserId: string,
): Promise<RealtimeMessage[]> {
  const sb = getSupabase();
  if (!sb || !isUuid(conversationId) || !isUuid(currentUserId)) return [];

  let targetConvId = conversationId;
  try {
    const { data: conv } = await sb
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv?.id) {
      const res = await getOrCreateDirectConversation(conversationId);
      if (res.conversationId && isUuid(res.conversationId)) {
        targetConvId = res.conversationId;
      } else {
        return [];
      }
    }

    const { data, error } = await sb
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", targetConvId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error || !data) return [];

    return data.map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      from: m.sender_id === currentUserId ? "me" : "them",
      text: m.body,
      at: new Date(m.created_at).getTime(),
      status: "sent",
    }));
  } catch {
    return [];
  }
}

/**
 * Sends a chat message via transactional Supabase RPC or offline fallback
 */
export async function sendChatMessage(
  conversationIdOrPeerId: string,
  body: string,
  _options?: { currentUserId?: string },
): Promise<{ success: boolean; messageId?: string; error: string | null }> {
  const cleanBody = sanitizeMessageBody(body);
  const validation = validateMessageBody(cleanBody);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const sb = getSupabase();
  if (!sb || !isUuid(conversationIdOrPeerId)) {
    return { success: true, messageId: crypto.randomUUID(), error: null };
  }

  let targetConvId = conversationIdOrPeerId;

  try {
    const { data: conv } = await sb
      .from("conversations")
      .select("id")
      .eq("id", conversationIdOrPeerId)
      .maybeSingle();

    if (!conv?.id) {
      // It's a peer user ID! Resolve real direct bilateral conversation
      const res = await getOrCreateDirectConversation(conversationIdOrPeerId);
      if (res.conversationId && isUuid(res.conversationId)) {
        targetConvId = res.conversationId;
      } else {
        return { success: false, error: res.error ?? "Could not resolve conversation" };
      }
    }
  } catch {
    // Continue with targetConvId
  }

  // If in mock or offline conv- format, return optimistic success
  if (targetConvId.startsWith("conv-") || !isUuid(targetConvId)) {
    return { success: true, messageId: crypto.randomUUID(), error: null };
  }

  const { data, error } = await sb.rpc("rpc_send_message", {
    p_conversation_id: targetConvId,
    p_body: cleanBody,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageId = (data as any)?.message_id ?? crypto.randomUUID();
  return { success: true, messageId, error: null };
}

/**
 * Subscribes to real-time conversation messages using Supabase Realtime Channels
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onNewMessage: (msg: RealtimeMessage) => void,
  currentUserId: string,
): () => void {
  const sb = getSupabase();
  if (!sb || !isUuid(conversationId)) {
    return () => {};
  }

  const channel = sb
    .channel(`conv:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newMsg = payload.new as any;
        onNewMessage({
          id: newMsg.id,
          conversationId: newMsg.conversation_id,
          senderId: newMsg.sender_id,
          from: newMsg.sender_id === currentUserId ? "me" : "them",
          text: newMsg.body,
          at: new Date(newMsg.created_at).getTime(),
          status: "sent",
        });
      },
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

/**
 * Marks conversation messages as read
 */
export async function markConversationRead(conversationId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !isUuid(conversationId)) return true;

  try {
    const { error } = await sb.rpc("rpc_mark_conversation_read", {
      p_conversation_id: conversationId,
    });
    if (error) {
      // Direct update fallback
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return false;

      await sb
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .match({ conversation_id: conversationId, user_id: user.id });
    }
    return true;
  } catch {
    return false;
  }
}
