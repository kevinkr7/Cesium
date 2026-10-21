import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Lock,
  Globe,
  Grid,
  Image as ImageIcon,
  Video,
  Heart,
  MessageSquare,
  Trash2,
  X,
  Volume2,
  VolumeX,
  Play,
  ArrowLeft,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useDemo } from "@/lib/store";
import { fetchUserPosts, deletePost, type Post } from "@/services/posts";
import { fetchProfile, type Profile } from "@/services/profiles";
import { fetchConnections } from "@/services/connections";

export const Route = createFileRoute("/profile")({
  validateSearch: (s: Record<string, unknown>) => ({
    u: typeof s["u"] === "string" ? (s["u"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Profile — Cesium" },
      { name: "description", content: "Your visual constellation profile, transmissions, and network archive." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ProfileRoute />
    </RequireAuth>
  ),
});

function ProfileRoute() {
  const { u } = Route.useSearch();
  const { session, profile: myProfile } = useDemo();
  const nav = useNavigate();
  const targetUserId = u || session?.id;
  const isMe = !u || u === session?.id;

  const [profile, setProfile] = useState<Profile | null>(isMe ? (myProfile ?? null) : null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video">("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    if (!targetUserId) return;
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [prof, userPosts, conns] = await Promise.all([
          isMe ? myProfile : fetchProfile(targetUserId!),
          fetchUserPosts(targetUserId!, session?.id),
          fetchConnections(targetUserId!),
        ]);

        if (!mounted) return;
        if (prof) setProfile(prof);
        setPosts(userPosts);
        setConnectionsCount(Object.keys(conns).length);
      } catch {
        toast.error("Could not load profile archive");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [targetUserId, isMe, myProfile, session?.id]);

  const handleDeletePost = async (postId: string) => {
    if (!session?.id) return;
    if (!confirm("Are you sure you want to delete this transmission permanently?")) return;

    const ok = await deletePost(postId, session.id);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setSelectedPost(null);
      toast.success("Transmission deleted");
    } else {
      toast.error("Could not delete post");
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (mediaFilter === "all") return true;
    return p.mediaType === mediaFilter;
  });

  const displayName = profile?.display_name || session?.name || "Explorer";
  const handle = profile?.handle ? `@${profile.handle.replace(/^@/, "")}` : "@orbit";

  return (
    <div className="min-h-screen bg-background pb-24 pt-6">
      <div className="mx-auto max-w-2xl px-4 md:px-0">
        {/* Back Link if viewing someone else */}
        {!isMe && (
          <button
            onClick={() => nav({ to: "/discover" })}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            <span>Back to Discover</span>
          </button>
        )}

        {/* Profile Header */}
        <div className="rounded-2xl border border-border/80 bg-surface/30 p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {profile?.avatar_path ? (
                <img
                  src={profile.avatar_path}
                  alt={displayName}
                  className="h-20 w-20 rounded-2xl border-2 border-border object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-border bg-surface-2 font-mono text-2xl font-bold text-signal shadow-lg">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <h1 className="display text-2xl font-bold text-foreground">{displayName}</h1>
                <p className="font-mono text-xs text-signal">{handle}</p>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin size={12} />
                  <span>{profile?.city || "Cesium Orbit"}</span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-6 border-t border-border/40 pt-4 sm:border-0 sm:pt-0">
              <div className="text-center">
                <span className="display block text-xl font-bold text-foreground">{posts.length}</span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Transmissions</span>
              </div>
              <div className="text-center">
                <span className="display block text-xl font-bold text-foreground">
                  {connectionsCount}
                </span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Connections</span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <p className="mt-4 text-xs leading-relaxed text-foreground/90">{profile.bio}</p>
          )}

          {/* Action Row */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
            {isMe ? (
              <>
                <Link
                  to="/feed"
                  className="btn-signal inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                >
                  <Plus size={14} />
                  <span>New Post</span>
                </Link>
                <Link
                  to="/constellation"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>Constellation Map</span>
                </Link>
              </>
            ) : (
              <button
                onClick={() => nav({ to: "/messages", search: { c: targetUserId } })}
                className="btn-signal inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold"
              >
                <MessageSquare size={14} />
                <span>Message</span>
              </button>
            )}
          </div>
        </div>

        {/* Media Filter Tabs */}
        <div className="mt-8 flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMediaFilter("all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                mediaFilter === "all" ? "bg-surface text-signal" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid size={14} />
              <span>All ({posts.length})</span>
            </button>
            <button
              onClick={() => setMediaFilter("image")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                mediaFilter === "image"
                  ? "bg-surface text-signal"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon size={14} />
              <span>Photos ({posts.filter((p) => p.mediaType === "image").length})</span>
            </button>
            <button
              onClick={() => setMediaFilter("video")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                mediaFilter === "video"
                  ? "bg-surface text-signal"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Video size={14} />
              <span>Videos ({posts.filter((p) => p.mediaType === "video").length})</span>
            </button>
          </div>
        </div>

        {/* Instagram-Style 3-Column Square Media Grid */}
        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-signal" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="my-10 rounded-2xl border border-dashed border-border/80 bg-surface/10 p-12 text-center">
            <ImageIcon size={28} className="mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-xs font-medium text-foreground">No media in this archive</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isMe
                ? "Photos and videos you transmit will appear in this grid."
                : "This user has not published transmissions under this filter."}
            </p>
            {isMe && (
              <Link
                to="/feed"
                className="btn-signal mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Plus size={14} />
                <span>Upload first transmission</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2.5">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-black/40 transition-transform active:scale-95"
              >
                {post.mediaType === "video" ? (
                  <video
                    src={post.mediaUrl}
                    className="h-full w-full object-cover"
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={post.mediaUrl}
                    alt={post.caption || "Post media"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                )}

                {/* Badge top-right */}
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                  {post.mediaType === "video" && (
                    <span className="rounded-md bg-black/60 p-1 text-white backdrop-blur-sm">
                      <Video size={11} />
                    </span>
                  )}
                  {post.visibility === "connections_only" && (
                    <span
                      className="rounded-md bg-signal/20 p-1 text-signal backdrop-blur-sm"
                      title="Connections only"
                    >
                      <Lock size={11} />
                    </span>
                  )}
                </div>

                {/* Hover overlay with likes */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Heart size={16} className="fill-white" />
                    <span>{post.likesCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox / Post Detail Focus Modal */}
      <AnimatePresence>
        {selectedPost && (
          <PostLightboxModal
            post={selectedPost}
            isOwner={selectedPost.userId === session?.id}
            onClose={() => setSelectedPost(null)}
            onDelete={() => handleDeletePost(selectedPost.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PostLightboxModal({
  post,
  isOwner,
  onClose,
  onDelete,
}: {
  post: Post;
  isOwner: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [isMuted, setIsMuted] = useState(false);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface md:flex-row"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-30 rounded-full bg-black/70 p-1.5 text-white backdrop-blur-sm hover:bg-black"
          aria-label="Close lightbox"
        >
          <X size={16} />
        </button>

        {/* Media Frame (Left 60%) */}
        <div className="relative flex aspect-square w-full items-center justify-center bg-black md:w-3/5">
          {post.mediaType === "video" ? (
            <div className="relative h-full w-full">
              <video
                src={post.mediaUrl}
                controls
                autoPlay
                loop
                muted={isMuted}
                className="h-full w-full object-contain"
              />
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="absolute bottom-3 right-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            </div>
          ) : (
            <img
              src={post.mediaUrl}
              alt={post.caption || "Transmission"}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        {/* Details Pane (Right 40%) */}
        <div className="flex w-full flex-col justify-between p-5 md:w-2/5">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-signal">
                  {post.author?.handle ? `@${post.author.handle.replace(/^@/, "")}` : "@orbit"}
                </span>
                {post.visibility === "connections_only" ? (
                  <span className="flex items-center gap-1 rounded bg-signal/10 px-1.5 py-0.5 font-mono text-[9px] text-signal">
                    <Lock size={9} /> Circle
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                    <Globe size={9} /> Public
                  </span>
                )}
              </div>
            </div>

            {post.caption && (
              <p className="mt-4 text-xs leading-relaxed text-foreground">{post.caption}</p>
            )}

            <div className="mt-4 font-mono text-[10px] text-muted-foreground">
              Transmitted {new Date(post.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div className="mt-6 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Heart size={16} className="text-signal" />
                <span>{post.likesCount} resonances</span>
              </div>

              {isOwner && (
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
