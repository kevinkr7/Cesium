import { getSupabase } from "@/lib/supabase/client";
import { stripHtml } from "@/lib/security";

export type PostVisibility = "public" | "connections_only";

export type Post = {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string | null | undefined;
  caption: string;
  visibility: PostVisibility;
  likesCount: number;
  commentsCount: number;
  hasLiked?: boolean | undefined;
  createdAt: string;
  author?:
    | {
        id: string;
        name: string;
        handle: string;
        city: string;
        avatar?: string | null | undefined;
      }
    | undefined;
};

export type CreatePostInput = {
  file: File;
  caption: string;
  visibility: PostVisibility;
  userId: string;
};

/**
 * Uploads media to Cloudflare R2 via our server endpoint
 */
export async function uploadMedia(
  file: File,
  userId: string,
): Promise<{ url: string; mediaType: "image" | "video"; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    const res = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      return { url: "", mediaType: "image", error: err.error || `Upload error (${res.status})` };
    }

    const data = await res.json();
    return {
      url: data.url,
      mediaType: data.mediaType || (file.type.startsWith("video") ? "video" : "image"),
    };
  } catch (err) {
    return {
      url: "",
      mediaType: "image",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Creates a new visual post in the database
 */
export async function createPost(
  input: CreatePostInput,
): Promise<{ post: Post | null; error?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { post: null, error: "Database client is not available" };
  }

  // 1. Upload media to Cloudflare R2 (or fallback dev storage)
  const upload = await uploadMedia(input.file, input.userId);
  if (upload.error || !upload.url) {
    return { post: null, error: upload.error || "Failed to upload media" };
  }

  // 2. Sanitize caption
  const sanitizedCaption = stripHtml(input.caption).trim().slice(0, 1000);

  try {
    const { data, error } = await sb
      .from("posts")
      .insert({
        user_id: input.userId,
        media_url: upload.url,
        media_type: upload.mediaType,
        caption: sanitizedCaption,
        visibility: input.visibility,
      })
      .select(
        `
        id,
        user_id,
        media_url,
        media_type,
        thumbnail_url,
        caption,
        visibility,
        likes_count,
        comments_count,
        created_at,
        profiles (
          id,
          display_name,
          handle,
          city,
          avatar_path
        )
      `,
      )
      .single();

    if (error || !data) {
      return { post: null, error: error?.message || "Failed to create post record" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    const rawProfile = row.profiles as {
      id: string;
      display_name: string;
      handle: string;
      city?: string | null;
      avatar_path?: string | null;
    } | null;

    const post: Post = {
      id: row.id,
      userId: row.user_id,
      mediaUrl: row.media_url,
      mediaType: row.media_type as "image" | "video",
      thumbnailUrl: row.thumbnail_url,
      caption: row.caption,
      visibility: row.visibility as PostVisibility,
      likesCount: row.likes_count ?? 0,
      commentsCount: row.comments_count ?? 0,
      hasLiked: false,
      createdAt: row.created_at,
      author: rawProfile
        ? {
            id: rawProfile.id,
            name: rawProfile.display_name,
            handle: rawProfile.handle,
            city: rawProfile.city ?? "Cesium Orbit",
            avatar: rawProfile.avatar_path,
          }
        : undefined,
    };

    return { post };
  } catch (err) {
    return { post: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fetches feed posts respecting visibility and RLS policies
 */
export async function fetchFeedPosts(
  currentUserId?: string,
  filter: "all" | "connections_only" = "all",
): Promise<Post[]> {
  const sb = getSupabase();
  if (!sb) {
    return [];
  }

  try {
    let query = sb
      .from("posts")
      .select(
        `
        id,
        user_id,
        media_url,
        media_type,
        thumbnail_url,
        caption,
        visibility,
        likes_count,
        comments_count,
        created_at,
        profiles (
          id,
          display_name,
          handle,
          city,
          avatar_path
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(30);

    if (filter === "connections_only") {
      query = query.eq("visibility", "connections_only");
    }

    const { data: postsData, error } = await query;
    if (error || !postsData) {
      return [];
    }

    // Check which posts current user has liked
    let likedPostIds = new Set<string>();
    if (currentUserId && postsData.length > 0) {
      const postIds = postsData.map((p) => p.id);
      const { data: likes } = await sb
        .from("post_likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", postIds);

      if (likes) {
        likedPostIds = new Set(likes.map((l) => l.post_id));
      }
    }

    return postsData.map((data) => {
      const rawProfile = (data as any).profiles as unknown as {
        id: string;
        display_name: string;
        handle: string;
        city?: string | null;
        avatar_path?: string | null;
      } | null;

      return {
        id: data.id,
        userId: data.user_id,
        mediaUrl: data.media_url,
        mediaType: data.media_type as "image" | "video",
        thumbnailUrl: data.thumbnail_url,
        caption: data.caption,
        visibility: data.visibility as PostVisibility,
        likesCount: data.likes_count ?? 0,
        commentsCount: data.comments_count ?? 0,
        hasLiked: likedPostIds.has(data.id),
        createdAt: data.created_at,
        author: rawProfile
          ? {
              id: rawProfile.id,
              name: rawProfile.display_name,
              handle: rawProfile.handle,
              city: rawProfile.city ?? "Cesium Orbit",
              avatar: rawProfile.avatar_path,
            }
          : undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetches posts by a specific user for their profile 3-column media grid
 */
export async function fetchUserPosts(
  targetUserId: string,
  currentUserId?: string,
): Promise<Post[]> {
  const sb = getSupabase();
  if (!sb) {
    return [];
  }

  try {
    const { data: postsData, error } = await sb
      .from("posts")
      .select(
        `
        id,
        user_id,
        media_url,
        media_type,
        thumbnail_url,
        caption,
        visibility,
        likes_count,
        comments_count,
        created_at,
        profiles (
          id,
          display_name,
          handle,
          city,
          avatar_path
        )
      `,
      )
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error || !postsData) {
      return [];
    }

    let likedPostIds = new Set<string>();
    if (currentUserId && postsData.length > 0) {
      const postIds = postsData.map((p) => p.id);
      const { data: likes } = await sb
        .from("post_likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", postIds);

      if (likes) {
        likedPostIds = new Set(likes.map((l) => l.post_id));
      }
    }

    return postsData.map((data) => {
      const rawProfile = (data as any).profiles as unknown as {
        id: string;
        display_name: string;
        handle: string;
        city?: string | null;
        avatar_path?: string | null;
      } | null;

      return {
        id: data.id,
        userId: data.user_id,
        mediaUrl: data.media_url,
        mediaType: data.media_type as "image" | "video",
        thumbnailUrl: data.thumbnail_url,
        caption: data.caption,
        visibility: data.visibility as PostVisibility,
        likesCount: data.likes_count ?? 0,
        commentsCount: data.comments_count ?? 0,
        hasLiked: likedPostIds.has(data.id),
        createdAt: data.created_at,
        author: rawProfile
          ? {
              id: rawProfile.id,
              name: rawProfile.display_name,
              handle: rawProfile.handle,
              city: rawProfile.city ?? "Cesium Orbit",
              avatar: rawProfile.avatar_path,
            }
          : undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Toggles a like (resonate) on a post
 */
export async function togglePostLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<{ success: boolean; likesCountDelta: number }> {
  const sb = getSupabase();
  if (!sb) return { success: false, likesCountDelta: 0 };

  try {
    if (currentlyLiked) {
      await sb.from("post_likes").delete().match({ post_id: postId, user_id: userId });
      return { success: true, likesCountDelta: -1 };
    } else {
      await sb.from("post_likes").insert({ post_id: postId, user_id: userId });
      return { success: true, likesCountDelta: 1 };
    }
  } catch {
    return { success: false, likesCountDelta: 0 };
  }
}

/**
 * Deletes a post owned by the user
 */
export async function deletePost(postId: string, userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from("posts").delete().match({ id: postId, user_id: userId });
    return !error;
  } catch {
    return false;
  }
}
