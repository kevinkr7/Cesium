import { getSupabase } from "@/lib/supabase/client";

export type RealtimeMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  from: "me" | "them";
  text: string;
  at: number;
};

/**
 * Break the Ice: deterministic starter templates generated from actual shared interests
 */
const ICEBREAKER_TEMPLATES: Record<string, string> = {
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

export function getIcebreakerStarters(sharedInterests: string[]): string[] {
  const starters: string[] = [];

  for (const interest of sharedInterests) {
    if (ICEBREAKER_TEMPLATES[interest]) {
      starters.push(ICEBREAKER_TEMPLATES[interest]!);
    }
  }

  // Fallbacks if fewer than 3 tailored starters exist
  const fallbacks = [
    "What's one project you'd build if nobody could judge it?",
    "What's the most interesting rabbit hole you've fallen into lately?",
    "What's something you're learning right now that feels quietly profound?",
  ];

  for (const fb of fallbacks) {
    if (starters.length < 3 && !starters.includes(fb)) {
      starters.push(fb);
    }
  }

  return starters.slice(0, 3);
}

export async function fetchConversationMessages(
  conversationId: string,
  currentUserId: string,
): Promise<RealtimeMessage[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    from: m.sender_id === currentUserId ? "me" : "them",
    text: m.body,
    at: new Date(m.created_at).getTime(),
  }));
}

export async function sendChatMessage(
  conversationId: string,
  body: string,
): Promise<{ success: boolean; messageId?: string; error: string | null }> {
  const sb = getSupabase();
  if (!sb) {
    return { success: true, messageId: crypto.randomUUID(), error: null };
  }

  const { data, error } = await sb.rpc("rpc_send_message", {
    p_conversation_id: conversationId,
    p_body: body.trim(),
  });

  if (error) return { success: false, error: error.message };
  return { success: true, messageId: data.message_id, error: null };
}

export function subscribeToConversationMessages(
  conversationId: string,
  onNewMessage: (msg: RealtimeMessage) => void,
  currentUserId: string,
) {
  const sb = getSupabase();
  if (!sb) return () => {};

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
        });
      },
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}
