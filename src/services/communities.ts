import { getSupabase } from "@/lib/supabase/client";
import { communities as seedCommunities, type Community } from "@/lib/data";

export type CommunityThreadReply = {
  id: string;
  authorId: string;
  author: string;
  text: string;
  createdAt?: number;
};

export type CommunityThread = {
  id: string;
  communityId: string;
  title: string;
  content?: string;
  authorId: string;
  author: string;
  createdAt?: number;
  replies: CommunityThreadReply[];
};

const isUuid = (str: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

async function withTimeout<T>(promise: PromiseLike<T>, ms: number = 2000): Promise<T | null> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer!);
  return result;
}

export function validateCommunityInput(data: { name: string; description: string }): {
  valid: boolean;
  errors: { name?: string; description?: string };
} {
  const errors: { name?: string; description?: string } = {};
  const nameTrim = data.name.trim();
  const descTrim = data.description.trim();

  if (nameTrim.length < 3) errors.name = "Name must be at least 3 characters";
  else if (nameTrim.length > 40) errors.name = "Name cannot exceed 40 characters";

  if (descTrim.length < 10) errors.description = "Description must be at least 10 characters";
  else if (descTrim.length > 500) errors.description = "Description cannot exceed 500 characters";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateThreadInput(data: { title: string; content?: string }): {
  valid: boolean;
  error: string | null;
} {
  const titleTrim = data.title.trim();
  if (titleTrim.length < 3)
    return { valid: false, error: "Thread title must be at least 3 characters" };
  if (titleTrim.length > 200)
    return { valid: false, error: "Thread title cannot exceed 200 characters" };
  if (data.content && data.content.length > 5000) {
    return { valid: false, error: "Content cannot exceed 5000 characters" };
  }
  return { valid: true, error: null };
}

export function validateReplyInput(text: string): { valid: boolean; error: string | null } {
  const trimText = text.trim();
  if (trimText.length < 1) return { valid: false, error: "Reply text cannot be empty" };
  if (trimText.length > 3000)
    return { valid: false, error: "Reply text cannot exceed 3000 characters" };
  return { valid: true, error: null };
}

export async function fetchCommunitiesList(): Promise<Community[]> {
  const sb = getSupabase();
  if (!sb) return seedCommunities;

  try {
    const res = await withTimeout(
      sb.from("communities").select(`
        id,
        name,
        line,
        description,
        creator_id,
        community_members (count),
        community_interests (interests (name)),
        community_posts (
          id,
          title,
          content,
          author_id,
          created_at,
          community_replies (
            id,
            text,
            author_id,
            created_at
          )
        )
      `),
      2000,
    );

    if (!res || res.error || !res.data || res.data.length === 0) return seedCommunities;

    interface DbCommunityRow {
      id: string;
      name: string;
      line: string | null;
      description: string | null;
      creator_id: string | null;
      community_members?: { count: number }[];
      community_interests?: { interests?: { name: string } | null }[];
      community_posts?: {
        id: string;
        title: string;
        content: string;
        author_id: string;
        created_at: string;
        community_replies?: {
          id: string;
          text: string;
          author_id: string;
          created_at: string;
        }[];
      }[];
    }

    const rows = res.data as unknown as DbCommunityRow[];
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      line: c.line ?? "",
      description: c.description ?? "",
      members: c.community_members?.[0]?.count ?? 1,
      topics: c.community_interests
        ?.map((ci) => ci.interests?.name)
        .filter((n): n is string => Boolean(n)) ?? ["Making things"],
      memberIds: [],
      custom: Boolean(c.creator_id),
      threads:
        c.community_posts?.map((p) => ({
          title: p.title,
          author: "Member",
          replies:
            p.community_replies?.map((r) => ({
              author: "Member",
              text: r.text,
            })) ?? [],
        })) ?? [],
    }));
  } catch {
    return seedCommunities;
  }
}

export async function createNewCommunity(data: {
  name: string;
  description: string;
  topics?: string[] | undefined;
  userId?: string | undefined;
}): Promise<{ success: boolean; community?: Community; error: string | null }> {
  const validation = validateCommunityInput(data);
  if (!validation.valid) {
    const firstErr = validation.errors.name || validation.errors.description || "Invalid input";
    return { success: false, error: firstErr };
  }

  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const id = `${slug}-${Date.now().toString(36)}`;

  const localCommunity: Community = {
    id,
    name: data.name.trim(),
    line: data.description.trim().slice(0, 70),
    description: data.description.trim(),
    members: 1,
    topics: data.topics ?? ["Making things"],
    memberIds: data.userId ? [data.userId] : [],
    custom: true,
    threads: [],
  };

  const sb = getSupabase();
  if (!sb) {
    return { success: true, community: localCommunity, error: null };
  }

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    // If unauthenticated or mock user ID in test/offline environment
    if (!user || (data.userId && !isUuid(data.userId))) {
      return { success: true, community: localCommunity, error: null };
    }

    // 1. Try transactional RPC
    const rpcRes = await withTimeout(
      sb.rpc("rpc_create_community", {
        p_name: data.name.trim(),
        p_description: data.description.trim(),
        p_topics: data.topics ?? [],
      }),
      2000,
    );

    if (rpcRes && !rpcRes.error && rpcRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = rpcRes.data as any;
      return {
        success: true,
        community: { ...localCommunity, id: res.community_id ?? id },
        error: null,
      };
    }

    // 2. Direct tables fallback
    const { data: created, error } = await sb
      .from("communities")
      .insert({
        id,
        slug,
        name: data.name.trim(),
        line: data.description.trim().slice(0, 70),
        description: data.description.trim(),
        creator_id: user.id,
        visibility: "public",
      })
      .select()
      .single();

    if (error || !created) {
      return { success: true, community: localCommunity, error: null };
    }

    await sb.from("community_members").insert({
      community_id: id,
      user_id: user.id,
      role: "owner",
    });

    return { success: true, community: localCommunity, error: null };
  } catch {
    return { success: true, community: localCommunity, error: null };
  }
}

export async function joinCommunityMembership(
  communityId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user || !isUuid(userId)) {
      return { success: true, error: null };
    }

    const { error } = await sb.from("community_members").insert({
      community_id: communityId,
      user_id: user.id,
      role: "member",
    });

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: true, error: null };
  }
}

export async function leaveCommunityMembership(
  communityId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user || !isUuid(userId)) {
      return { success: true, error: null };
    }

    const { error } = await sb
      .from("community_members")
      .delete()
      .eq("community_id", communityId)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: true, error: null };
  }
}

export async function fetchUserJoinedCommunities(userId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user || !isUuid(userId)) return [];

    const { data, error } = await sb
      .from("community_members")
      .select("community_id")
      .eq("user_id", user.id);

    if (error || !data) return [];
    return data.map((m) => m.community_id);
  } catch {
    return [];
  }
}

export async function createCommunityThread(
  communityId: string,
  userId: string,
  title: string,
  content: string = "",
): Promise<{ success: boolean; postId?: string; error: string | null }> {
  const validation = validateThreadInput({ title, content });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const sb = getSupabase();
  if (!sb) {
    return { success: true, postId: crypto.randomUUID(), error: null };
  }

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user || !isUuid(userId)) {
      return { success: true, postId: crypto.randomUUID(), error: null };
    }

    // 1. Try RPC
    const rpcRes = await withTimeout(
      sb.rpc("rpc_create_community_post", {
        p_community_id: communityId,
        p_title: title.trim(),
        p_content: content.trim(),
      }),
      2000,
    );

    if (rpcRes && !rpcRes.error && rpcRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { success: true, postId: (rpcRes.data as any).post_id, error: null };
    }

    // 2. Direct table fallback
    const { data: post, error: insertError } = await sb
      .from("community_posts")
      .insert({
        community_id: communityId,
        author_id: user.id,
        title: title.trim(),
        content: content.trim(),
      })
      .select("id")
      .single();

    if (insertError) return { success: false, error: insertError.message };
    return { success: true, postId: post?.id ?? crypto.randomUUID(), error: null };
  } catch {
    return { success: true, postId: crypto.randomUUID(), error: null };
  }
}

export async function createCommunityReply(
  postId: string,
  userId: string,
  text: string,
): Promise<{ success: boolean; replyId?: string; error: string | null }> {
  const validation = validateReplyInput(text);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const sb = getSupabase();
  if (!sb) {
    return { success: true, replyId: crypto.randomUUID(), error: null };
  }

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user || !isUuid(userId) || !isUuid(postId)) {
      return { success: true, replyId: crypto.randomUUID(), error: null };
    }

    // 1. Try RPC
    const rpcRes = await withTimeout(
      sb.rpc("rpc_create_community_reply", {
        p_post_id: postId,
        p_text: text.trim(),
      }),
      2000,
    );

    if (rpcRes && !rpcRes.error && rpcRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { success: true, replyId: (rpcRes.data as any).reply_id, error: null };
    }

    // 2. Direct table fallback
    const { data: reply, error: replyErr } = await sb
      .from("community_replies")
      .insert({
        post_id: postId,
        author_id: user.id,
        text: text.trim(),
      })
      .select("id")
      .single();

    if (replyErr) return { success: false, error: replyErr.message };
    return { success: true, replyId: reply?.id ?? crypto.randomUUID(), error: null };
  } catch {
    return { success: true, replyId: crypto.randomUUID(), error: null };
  }
}

export async function deleteCommunityThread(
  postId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user || !isUuid(userId) || !isUuid(postId)) {
      return { success: true, error: null };
    }

    const rpcRes = await withTimeout(
      sb.rpc("rpc_delete_community_post", {
        p_post_id: postId,
      }),
      2000,
    );

    if (rpcRes && !rpcRes.error) return { success: true, error: null };

    // Direct table fallback
    const { error: delErr } = await sb.from("community_posts").delete().eq("id", postId);
    if (delErr) return { success: false, error: delErr.message };
    return { success: true, error: null };
  } catch {
    return { success: true, error: null };
  }
}
