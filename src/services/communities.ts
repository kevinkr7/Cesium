import { getSupabase } from "@/lib/supabase/client";
import { communities as seedCommunities, type Community } from "@/lib/data";

export async function fetchCommunitiesList(): Promise<Community[]> {
  const sb = getSupabase();
  if (!sb) return seedCommunities;

  const { data, error } = await sb.from("communities").select(`
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
        author_id,
        community_replies (
          text,
          author_id
        )
      )
    `);

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
      author_id: string;
      community_replies?: {
        text: string;
        author_id: string;
      }[];
    }[];
  }

  if (error || !data || data.length === 0) return seedCommunities;

  const rows = data as unknown as DbCommunityRow[];
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
}

export async function createNewCommunity(data: {
  name: string;
  description: string;
  topics?: string[] | undefined;
  userId?: string | undefined;
}): Promise<{ success: boolean; community?: Community; error: string | null }> {
  const sb = getSupabase();
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const id = `${slug}-${Date.now().toString(36)}`;

  if (!sb) {
    const comm: Community = {
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
    return { success: true, community: comm, error: null };
  }

  const { data: created, error } = await sb
    .from("communities")
    .insert({
      id,
      slug,
      name: data.name.trim(),
      line: data.description.trim().slice(0, 70),
      description: data.description.trim(),
      creator_id: data.userId ?? null,
      visibility: "public",
    })
    .select()
    .single();

  if (error || !created) {
    return { success: false, error: error?.message ?? "Failed to create community" };
  }

  // Add creator as owner member
  if (data.userId) {
    await sb.from("community_members").insert({
      community_id: id,
      user_id: data.userId,
      role: "owner",
    });
  }

  const comm: Community = {
    id: created.id,
    name: created.name,
    line: created.line,
    description: created.description,
    members: 1,
    topics: data.topics ?? ["Making things"],
    memberIds: data.userId ? [data.userId] : [],
    custom: true,
    threads: [],
  };

  return { success: true, community: comm, error: null };
}

export async function joinCommunityMembership(
  communityId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const { error } = await sb.from("community_members").insert({
    community_id: communityId,
    user_id: userId,
    role: "member",
  });

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function leaveCommunityMembership(
  communityId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const { error } = await sb
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function createCommunityThread(
  communityId: string,
  userId: string,
  title: string,
  content: string = "",
): Promise<{ success: boolean; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { success: true, error: null };

  const { error } = await sb.from("community_posts").insert({
    community_id: communityId,
    author_id: userId,
    title: title.trim(),
    content: content.trim(),
  });

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
