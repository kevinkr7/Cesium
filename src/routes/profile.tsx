import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
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
  ArrowLeft,
  Loader2,
  Plus,
  Sliders,
  History,
  Check,
  Upload,
  Bell,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { setDemo, useDemo } from "@/lib/store";
import {
  fetchUserPosts,
  fetchUserLikedPosts,
  deletePost,
  type Post,
} from "@/services/posts";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  isHandleAvailable,
  type Profile,
} from "@/services/profiles";
import { fetchConnections } from "@/services/connections";
import {
  fetchNotifications,
  type AppNotification,
} from "@/services/notifications";
import { saveUserInterests, fetchAllInterests } from "@/services/interests";
import { interestCategories } from "@/lib/data";

const CONVERSATION_STYLE_OPTIONS = [
  "Deep dives",
  "Slow & thoughtful",
  "Technical",
  "Listener",
  "Playful banter",
  "Rapid-fire ideas",
  "Show, don't tell",
];

export const Route = createFileRoute("/profile")({
  validateSearch: (s: Record<string, unknown>) => ({
    u: typeof s["u"] === "string" ? (s["u"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Profile — Cesium" },
      {
        name: "description",
        content:
          "Your visual constellation profile, transmissions, and network archive.",
      },
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
  const demo = useDemo();
  const nav = useNavigate();
  const targetUserId = u || demo.session?.id;
  const isMe = !u || u === demo.session?.id;

  const [profile, setProfile] = useState<Profile | null>(
    isMe ? (demo.profile ?? null) : null,
  );
  const [activeSection, setActiveSection] = useState<"posts" | "liked" | "history">("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [notificationsHistory, setNotificationsHistory] = useState<AppNotification[]>([]);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video">("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [prof, userPosts, userLiked, conns, notifs] = await Promise.all([
          isMe ? demo.profile : fetchProfile(targetUserId!),
          fetchUserPosts(targetUserId!, demo.session?.id),
          fetchUserLikedPosts(targetUserId!, demo.session?.id),
          fetchConnections(targetUserId!),
          isMe && demo.session?.id ? fetchNotifications(demo.session.id) : Promise.resolve([]),
        ]);

        if (!mounted) return;
        if (prof) setProfile(prof);
        setPosts(userPosts);
        setLikedPosts(userLiked);
        setConnectionsCount(Object.keys(conns).length);
        setNotificationsHistory(notifs);
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
  }, [targetUserId, isMe, demo.profile, demo.session?.id]);

  const handleDeletePost = async (postId: string) => {
    if (!demo.session?.id) return;
    if (!confirm("Are you sure you want to delete this transmission permanently?")) return;

    const ok = await deletePost(postId, demo.session.id);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setLikedPosts((prev) => prev.filter((p) => p.id !== postId));
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

  const displayName = profile?.display_name || demo.session?.name || "Explorer";
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
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Posts</span>
              </div>
              <div className="text-center">
                <span className="display block text-xl font-bold text-foreground">
                  {connectionsCount}
                </span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Connections</span>
              </div>
              <div className="text-center">
                <span className="display block text-xl font-bold text-foreground">
                  {likedPosts.length}
                </span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Liked</span>
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
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground transition-colors hover:border-signal/50 hover:bg-surface-2"
                >
                  <Sliders size={13} className="text-signal" />
                  <span>Configure Constellation</span>
                </button>
                <Link
                  to="/constellation"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Sparkles size={13} />
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

        {/* 3 Primary Profile Sections */}
        <div className="mt-8 border-b border-border/60">
          <div className="flex gap-4 sm:gap-8">
            <button
              onClick={() => setActiveSection("posts")}
              className={`relative flex items-center gap-2 pb-3 font-mono text-xs font-medium uppercase tracking-wider transition-colors ${
                activeSection === "posts" ? "text-signal font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid size={15} />
              <span>Transmissions ({posts.length})</span>
              {activeSection === "posts" && (
                <motion.div
                  layoutId="profile-tab-line"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-signal"
                />
              )}
            </button>

            <button
              onClick={() => setActiveSection("liked")}
              className={`relative flex items-center gap-2 pb-3 font-mono text-xs font-medium uppercase tracking-wider transition-colors ${
                activeSection === "liked" ? "text-signal font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart size={15} />
              <span>Liked ({likedPosts.length})</span>
              {activeSection === "liked" && (
                <motion.div
                  layoutId="profile-tab-line"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-signal"
                />
              )}
            </button>

            {isMe && (
              <button
                onClick={() => setActiveSection("history")}
                className={`relative flex items-center gap-2 pb-3 font-mono text-xs font-medium uppercase tracking-wider transition-colors ${
                  activeSection === "history" ? "text-signal font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <History size={15} />
                <span>History ({notificationsHistory.length})</span>
                {activeSection === "history" && (
                  <motion.div
                    layoutId="profile-tab-line"
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-signal"
                  />
                )}
              </button>
            )}
          </div>
        </div>

        {/* SECTION 1: POSTS */}
        {activeSection === "posts" && (
          <div className="pt-4">
            {/* Filter buttons */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setMediaFilter("all")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  mediaFilter === "all" ? "bg-surface text-signal" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({posts.length})
              </button>
              <button
                onClick={() => setMediaFilter("image")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  mediaFilter === "image" ? "bg-surface text-signal" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Photos ({posts.filter((p) => p.mediaType === "image").length})
              </button>
              <button
                onClick={() => setMediaFilter("video")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  mediaFilter === "video" ? "bg-surface text-signal" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Videos ({posts.filter((p) => p.mediaType === "video").length})
              </button>
            </div>

            {loading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-signal" />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-border/80 bg-surface/10 p-12 text-center">
                <ImageIcon size={28} className="mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">No transmissions in this archive</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isMe ? "Photos and videos you post will appear in this grid." : "This user has no posts."}
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
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                {filteredPosts.map((post) => (
                  <PostMediaTile
                    key={post.id}
                    post={post}
                    onClick={() => setSelectedPost(post)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: LIKED POSTS */}
        {activeSection === "liked" && (
          <div className="pt-4">
            {loading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-signal" />
              </div>
            ) : likedPosts.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-border/80 bg-surface/10 p-12 text-center">
                <Heart size={28} className="mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">No liked transmissions yet</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Transmissions you resonate with across Cesium will appear here.
                </p>
                <Link
                  to="/feed"
                  className="btn-signal mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <span>Explore Signals Feed</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                {likedPosts.map((post) => (
                  <PostMediaTile
                    key={post.id}
                    post={post}
                    onClick={() => setSelectedPost(post)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: HISTORY (STORED NOTIFICATIONS) */}
        {activeSection === "history" && isMe && (
          <div className="space-y-3 pt-4">
            {notificationsHistory.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-border/80 bg-surface/10 p-12 text-center">
                <Bell size={28} className="mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">No stored notifications</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Your archive of all past connection requests, resonances, and alerts will be preserved here.
                </p>
              </div>
            ) : (
              notificationsHistory.map((notif) => {
                const isMsg =
                  notif.type === "new_message" || notif.title.toLowerCase().includes("message");
                return (
                  <div
                    key={notif.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-surface/30 p-3.5 backdrop-blur-sm transition-colors hover:border-signal/40"
                  >
                    <div className="flex items-start gap-3">
                      {notif.sender?.avatar ? (
                        <img
                          src={notif.sender.avatar}
                          alt={notif.sender.name}
                          className="h-9 w-9 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-xs text-signal">
                          <Bell size={14} />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-foreground">{notif.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {new Date(notif.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMsg && (
                        <Link
                          to="/messages"
                          search={{ c: notif.sender?.id }}
                          className="inline-flex items-center gap-1 rounded bg-signal/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-signal hover:bg-signal/25"
                        >
                          <span>Chat</span>
                          <ArrowUpRight size={10} />
                        </Link>
                      )}
                      {notif.type === "connection_accepted" && notif.sender && (
                        <Link
                          to="/messages"
                          search={{ c: notif.sender.id }}
                          className="inline-flex items-center gap-1 rounded bg-surface-2 px-2.5 py-1 font-mono text-[10px] text-foreground hover:bg-surface"
                        >
                          <span>Message</span>
                          <ArrowUpRight size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Lightbox / Post Detail Focus Modal */}
      <AnimatePresence>
        {selectedPost && (
          <PostLightboxModal
            post={selectedPost}
            isOwner={selectedPost.userId === demo.session?.id}
            onClose={() => setSelectedPost(null)}
            onDelete={() => handleDeletePost(selectedPost.id)}
          />
        )}
      </AnimatePresence>

      {/* Configure Constellation Modal */}
      <AnimatePresence>
        {isConfigOpen && profile && (
          <ConfigureConstellationModal
            profile={profile}
            userId={demo.session?.id || ""}
            interests={demo.interests || []}
            niche={demo.niche || []}
            onClose={() => setIsConfigOpen(false)}
            onSave={(updatedProfile, updatedInterests, updatedNiche) => {
              setProfile(updatedProfile);
              setDemo((s) => ({
                profile: updatedProfile,
                interests: updatedInterests,
                niche: updatedNiche,
              }));
              setIsConfigOpen(false);
              toast.success("Constellation & cadence recalibrated successfully!");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PostMediaTile({ post, onClick }: { post: Post; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
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

function ConfigureConstellationModal({
  profile,
  userId,
  interests,
  niche,
  onClose,
  onSave,
}: {
  profile: Profile;
  userId: string;
  interests: string[];
  niche: string[];
  onClose: () => void;
  onSave: (updatedProfile: Profile, updatedInterests: string[], updatedNiche: string[]) => void;
}) {
  const [tab, setTab] = useState<"core" | "personal" | "cadence">("core");
  const [pickedInterests, setPickedInterests] = useState<string[]>(interests);
  const [nicheInput, setNicheInput] = useState(niche.join(", "));
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle || "");
  const [city, setCity] = useState(profile.city || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [styles, setStyles] = useState<string[]>(profile.conversation_style || []);
  const [topics, setTopics] = useState(profile.topics || "");
  const [discoverable, setDiscoverable] = useState(profile.discoverable);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_path || null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleInterest = (name: string) => {
    setPickedInterests((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name],
    );
  };

  const toggleStyle = (style: string) => {
    setStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style],
    );
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      let finalAvatar = profile.avatar_path;
      if (avatarFile) {
        const uploadRes = await uploadAvatar(userId, avatarFile);
        if (uploadRes.url) {
          finalAvatar = uploadRes.url;
        }
      }

      const parsedNiche = nicheInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await saveUserInterests(userId, pickedInterests, parsedNiche);

      const updatePayload = {
        display_name: displayName.trim() || profile.display_name,
        handle: handle.trim().replace(/^@/, ""),
        city: city.trim(),
        bio: bio.trim(),
        topics: topics.trim(),
        conversation_style: styles,
        discoverable,
        ...(finalAvatar ? { avatar_path: finalAvatar } : {}),
      };

      await updateProfile(userId, updatePayload);

      const updatedProfile: Profile = {
        ...profile,
        ...updatePayload,
        avatar_path: finalAvatar ?? profile.avatar_path,
      };

      onSave(updatedProfile, pickedInterests, parsedNiche);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-signal" />
            <span className="font-display text-sm font-bold text-foreground">
              Configure Constellation & Cadence
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-border/40 px-4">
          <button
            onClick={() => setTab("core")}
            className={`px-3 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors ${
              tab === "core" ? "border-b-2 border-signal text-signal" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Core Constellation
          </button>
          <button
            onClick={() => setTab("personal")}
            className={`px-3 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors ${
              tab === "personal" ? "border-b-2 border-signal text-signal" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Personal Identity
          </button>
          <button
            onClick={() => setTab("cadence")}
            className={`px-3 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors ${
              tab === "cadence" ? "border-b-2 border-signal text-signal" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Resonance & Cadence
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {tab === "core" && (
            <div className="space-y-4">
              <div>
                <label className="label-mono block text-[10px] text-muted-foreground">
                  INTEREST CATEGORIES (CLICK TO TOGGLE)
                </label>
                <div className="mt-2 space-y-3">
                  {Object.entries(interestCategories).map(([catName, items]) => (
                    <div key={catName}>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground/70">
                        {catName}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {items.map((item) => {
                          const active = pickedInterests.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleInterest(item)}
                              className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                                active
                                  ? "bg-signal text-ink font-semibold shadow-sm"
                                  : "border border-border/60 bg-surface/60 text-muted-foreground hover:border-border hover:text-foreground"
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/40 pt-3">
                <label className="label-mono block text-[10px] text-muted-foreground">
                  NICHE OBSESSIONS (COMMA SEPARATED)
                </label>
                <input
                  type="text"
                  value={nicheInput}
                  onChange={(e) => setNicheInput(e.target.value)}
                  placeholder="e.g. Mechanical keyboards, Soviet Brutalism, RISC-V"
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-signal focus:outline-none"
                />
              </div>
            </div>
          )}

          {tab === "personal" && (
            <div className="space-y-3.5">
              {/* Avatar Picker */}
              <div className="flex items-center gap-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="h-16 w-16 rounded-2xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-2 font-mono text-sm text-signal">
                    NO PIC
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground hover:border-signal"
                  >
                    <Upload size={12} />
                    <span>Upload new photo</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG or WebP up to 5MB</p>
                </div>
              </div>

              <div>
                <label className="label-mono block text-[10px] text-muted-foreground">DISPLAY NAME</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-signal focus:outline-none"
                />
              </div>

              <div>
                <label className="label-mono block text-[10px] text-muted-foreground">HANDLE</label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-signal focus:outline-none"
                />
              </div>

              <div>
                <label className="label-mono block text-[10px] text-muted-foreground">CITY / ORBIT</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-signal focus:outline-none"
                />
              </div>

              <div>
                <label className="label-mono block text-[10px] text-muted-foreground">BIO</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-signal focus:outline-none"
                />
              </div>
            </div>
          )}

          {tab === "cadence" && (
            <div className="space-y-4">
              <div>
                <label className="label-mono block text-[10px] text-muted-foreground">
                  CONVERSATION STYLES (CADENCE)
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CONVERSATION_STYLE_OPTIONS.map((style) => {
                    const active = styles.includes(style);
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => toggleStyle(style)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
                          active
                            ? "border border-signal bg-signal/15 font-medium text-signal"
                            : "border border-border/60 bg-surface/50 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        {active && <Check size={11} />}
                        <span>{style}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/40 pt-3">
                <label className="label-mono block text-[10px] text-muted-foreground">
                  TOPICS OF INTELLECTUAL RESONANCE
                </label>
                <input
                  type="text"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. Distributed systems, Type design, Ambient electronic music"
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-signal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Discoverable in Constellation</p>
                  <p className="text-[10px] text-muted-foreground">
                    Allow others to find your node via shared frequencies.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={discoverable}
                  onChange={(e) => setDiscoverable(e.target.checked)}
                  className="h-4 w-4 rounded accent-signal"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/60 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="btn-signal inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            <span>Save Constellation</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
