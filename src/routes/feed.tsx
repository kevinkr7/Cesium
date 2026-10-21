import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  MessageSquare,
  Lock,
  Globe,
  Plus,
  X,
  Upload,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Loader2,
  Image as ImageIcon,
  Video,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useDemo } from "@/lib/store";
import {
  fetchFeedPosts,
  createPost,
  togglePostLike,
  deletePost,
  type Post,
  type PostVisibility,
} from "@/services/posts";
import { validateMediaFile } from "@/lib/r2";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Signals Feed — Cesium" },
      { name: "description", content: "Visual transmittals, photos, and video logs from your network." },
      { property: "og:title", content: "Signals Feed — Cesium" },
      { property: "og:description", content: "Watch and share visual moments across your constellation." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <FeedPage />
    </RequireAuth>
  ),
});

function FeedPage() {
  const { session } = useDemo();
  const nav = useNavigate();
  const [tab, setTab] = useState<"all" | "connections_only">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await fetchFeedPosts(session?.id, tab);
      setPosts(data);
    } catch {
      toast.error("Could not load feed posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [tab, session?.id]);

  const handleLike = async (post: Post) => {
    if (!session?.id) return;
    const currentlyLiked = Boolean(post.hasLiked);
    const delta = currentlyLiked ? -1 : 1;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              hasLiked: !currentlyLiked,
              likesCount: Math.max(0, p.likesCount + delta),
            }
          : p,
      ),
    );

    const res = await togglePostLike(post.id, session.id, currentlyLiked);
    if (!res.success) {
      // Revert if failed
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                hasLiked: currentlyLiked,
                likesCount: Math.max(0, p.likesCount - delta),
              }
            : p,
        ),
      );
      toast.error("Could not register reaction");
    }
  };

  const handleDelete = async (postId: string) => {
    if (!session?.id) return;
    if (!confirm("Are you sure you want to remove this transmission?")) return;

    const ok = await deletePost(postId, session.id);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post removed from feed");
    } else {
      toast.error("Could not delete post");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 pt-8">
      <div className="mx-auto max-w-xl px-4 md:px-0">
        {/* Header Bar */}
        <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-4">
          <div>
            <p className="label-mono text-xs text-signal">TRANSMISSIONS // VISUAL FEED</p>
            <h1 className="display mt-1 text-3xl font-bold tracking-tight text-foreground">
              Signals
            </h1>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-signal flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
          >
            <Plus size={16} />
            <span>New Post</span>
          </button>
        </div>

        {/* Tab Filters */}
        <div className="mb-6 flex gap-2 border-b border-border/40 pb-2">
          <button
            onClick={() => setTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "all"
                ? "bg-surface text-signal shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Signals (Public + Network)
          </button>
          <button
            onClick={() => setTab("connections_only")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "connections_only"
                ? "bg-surface text-signal shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock size={12} />
            <span>Connections Only</span>
          </button>
        </div>

        {/* Feed Posts */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-signal" />
            <p className="font-mono text-xs">Tuning into transmission frequency…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-surface/20 p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-signal">
              <ImageIcon size={22} />
            </div>
            <h2 className="text-sm font-semibold text-foreground">No transmittals here yet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {tab === "connections_only"
                ? "None of your connections have published private transmissions yet."
                : "Be the first in your orbit to broadcast a photo or video."}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-signal mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Plus size={14} />
              <span>Share first post</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={session?.id}
                onLike={() => handleLike(post)}
                onDelete={() => handleDelete(post.id)}
                onReply={() => nav({ to: "/messages", search: { c: post.userId } })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <CreatePostModal
            userId={session?.id || ""}
            onClose={() => setIsCreateOpen(false)}
            onCreated={(newPost) => {
              setPosts((prev) => [newPost, ...prev]);
              setIsCreateOpen(false);
              toast.success("Post transmitted successfully!");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
  onReply,
}: {
  post: Post;
  currentUserId?: string | undefined;
  onLike: () => void;
  onDelete: () => void;
  onReply: () => void;
}) {
  const isOwner = currentUserId === post.userId;
  const authorName = post.author?.name || "Anonymous";
  const authorHandle = post.author?.handle ? `@${post.author.handle.replace(/^@/, "")}` : "@orbit";

  return (
    <article className="overflow-hidden rounded-2xl border border-border/80 bg-surface/30 backdrop-blur-sm transition-all hover:border-border">
      {/* Author Header */}
      <div className="flex items-center justify-between p-3.5">
        <Link
          to="/profile"
          search={{ u: post.userId }}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          {post.author?.avatar ? (
            <img
              src={post.author.avatar}
              alt={authorName}
              className="h-9 w-9 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-xs font-bold text-signal">
              {authorName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">{authorName}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{authorHandle}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{post.author?.city || "Cesium Orbit"}</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {post.visibility === "connections_only" ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-medium text-signal"
              title="Only visible to accepted connections"
            >
              <Lock size={10} />
              <span>Circle</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
              title="Visible to all Cesium users"
            >
              <Globe size={10} />
              <span>Public</span>
            </span>
          )}

          {isOwner && (
            <button
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-destructive"
              title="Delete transmission"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Media Player / Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-black/60">
        {post.mediaType === "video" ? (
          <VideoPlayer src={post.mediaUrl} />
        ) : (
          <img
            src={post.mediaUrl}
            alt={post.caption || "Cesium post"}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            loading="lazy"
          />
        )}
      </div>

      {/* Actions & Caption */}
      <div className="p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                post.hasLiked ? "text-destructive" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart size={18} className={post.hasLiked ? "fill-destructive" : ""} />
              <span>{post.likesCount}</span>
            </button>

            <button
              onClick={onReply}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              title="Direct message regarding this post"
            >
              <MessageSquare size={17} />
              <span>Reply</span>
            </button>
          </div>

          <span className="font-mono text-[10px] text-muted-foreground">
            {formatRelativeTime(post.createdAt)}
          </span>
        </div>

        {post.caption && (
          <p className="mt-2 text-xs leading-relaxed text-foreground/90">
            <span className="font-semibold text-foreground">{authorName} </span>
            {post.caption}
          </p>
        )}
      </div>
    </article>
  );
}

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className="relative h-full w-full group">
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        muted={isMuted}
        onClick={togglePlay}
        className="h-full w-full object-cover cursor-pointer"
      />

      <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-90 transition-opacity">
        <button
          onClick={toggleMute}
          className="rounded-full bg-black/70 p-1.5 text-white shadow-md backdrop-blur-sm hover:bg-black"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>

      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity group-hover:bg-black/20"
          aria-label="Play video"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            <Play size={20} className="translate-x-0.5" />
          </div>
        </button>
      )}
    </div>
  );
}

function CreatePostModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: (post: Post) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [busy, setBusy] = useState(false);

  const handleFile = (picked: File) => {
    const val = validateMediaFile({ size: picked.size, type: picked.type });
    if (!val.valid) {
      toast.error(val.error || "Invalid media file");
      return;
    }
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please pick a photo or video to transmit");
      return;
    }

    setBusy(true);
    const res = await createPost({
      file,
      caption,
      visibility,
      userId,
    });
    setBusy(false);

    if (res.error || !res.post) {
      toast.error(res.error || "Failed to publish post");
      return;
    }

    onCreated(res.post);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            New Transmission
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* File Picker / Preview */}
          {!previewUrl ? (
            <label className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 p-4 text-center transition-colors hover:border-signal/60 hover:bg-background/80">
              <Upload size={28} className="text-signal" />
              <p className="mt-2 text-xs font-semibold text-foreground">Click to upload photo or video</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                MP4, WebM (≤50MB) · JPG, PNG, WebP (≤10MB)
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) handleFile(picked);
                }}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
              {file?.type.startsWith("video") ? (
                <video src={previewUrl} controls className="h-full w-full object-contain" />
              ) : (
                <img src={previewUrl} alt="Preview" className="h-full w-full object-contain" />
              )}
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                title="Remove media"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="label-mono text-[11px] text-muted-foreground">Caption / Notes</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What are you building, capturing, or exploring?"
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background/60 p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-signal focus:outline-none"
            />
            <span className="float-right font-mono text-[10px] text-muted-foreground">
              {caption.length}/1000
            </span>
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="label-mono text-[11px] text-muted-foreground">Access Visibility</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-all ${
                  visibility === "public"
                    ? "border-signal bg-signal/10 text-foreground"
                    : "border-border bg-background/40 text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                  className="accent-signal"
                />
                <div>
                  <p className="flex items-center gap-1 text-xs font-semibold">
                    <Globe size={12} /> Public
                  </p>
                  <p className="text-[10px] text-muted-foreground">Broadcast to all of Cesium</p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-all ${
                  visibility === "connections_only"
                    ? "border-signal bg-signal/10 text-foreground"
                    : "border-border bg-background/40 text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="connections_only"
                  checked={visibility === "connections_only"}
                  onChange={() => setVisibility("connections_only")}
                  className="accent-signal"
                />
                <div>
                  <p className="flex items-center gap-1 text-xs font-semibold">
                    <Lock size={12} /> Connections Only
                  </p>
                  <p className="text-[10px] text-muted-foreground">Strictly mutual connections</p>
                </div>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !file}
              className="btn-signal flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Transmitting…</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Transmit Post</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}
