import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState, useRef } from "react";
import {
  X,
  RotateCcw,
  Camera,
  Edit3,
  Trash2,
  ArrowLeftRight,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { interestCategories, people, shared } from "@/lib/data";
import { resetDemo, setDemo, useDemo } from "@/lib/store";
import {
  saveUserInterests,
  toggleInterestType,
  validateMinCuratedInterests,
} from "@/services/interests";
import {
  updateProfile,
  uploadAvatar,
  deleteUserAccount,
  validateProfileUpdates,
  isHandleAvailable,
  MAX_AVATAR_SIZE_BYTES,
  ALLOWED_AVATAR_MIME_TYPES,
} from "@/services/profiles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/constellation")({
  head: () => ({
    meta: [
      { title: "Your constellation — Cesium" },
      {
        name: "description",
        content: "Your personal universe of interests, obsessions and overlaps.",
      },
      { property: "og:title", content: "Your constellation — Cesium" },
      {
        property: "og:description",
        content: "A personal digital universe of everything you care about.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Constellation />
    </RequireAuth>
  ),
});

const CONVERSATION_STYLES = ["Deep Dives", "Playful Banter", "Technical", "Listener"];

const catOf = (x: string) =>
  Object.entries(interestCategories).find(([, l]) => l.includes(x))?.[0] ?? "Niche";
const cats = [...Object.keys(interestCategories), "Niche"];

function Constellation() {
  const demo = useDemo();
  const navigate = useNavigate();
  const all = [...demo.interests, ...demo.niche];

  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [add, setAdd] = useState("");

  // Profile edit modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(
    demo.profile?.display_name ?? demo.session?.name ?? "Explorer",
  );
  const [editHandle, setEditHandle] = useState(demo.profile?.handle ?? "explorer");
  const [editCity, setEditCity] = useState(demo.profile?.city ?? demo.city ?? "Worldwide");
  const [editBio, setEditBio] = useState(demo.profile?.bio ?? demo.bio);
  const initialStyle =
    Array.isArray(demo.profile?.conversation_style) && demo.profile.conversation_style.length > 0
      ? demo.profile.conversation_style[0]!
      : (demo.styles[0] ?? "Deep Dives");
  const [editStyle, setEditStyle] = useState<string>(initialStyle);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const displayName = demo.profile?.display_name ?? demo.session?.name ?? "Explorer";
  const handle = demo.profile?.handle ? `@${demo.profile.handle}` : "@explorer";
  const city = demo.profile?.city ?? demo.city ?? "Worldwide";
  const bio = demo.profile?.bio ?? demo.bio;
  const conversationStyle =
    Array.isArray(demo.profile?.conversation_style) && demo.profile.conversation_style.length > 0
      ? demo.profile.conversation_style[0]!
      : (demo.styles[0] ?? "Deep Dives");
  const avatarUrl = demo.profile?.avatar_path;

  // group by category around clusters
  const groups = cats
    .map((c) => ({ c, items: all.filter((x) => catOf(x) === c) }))
    .filter((g) => g.items.length);
  const pos: Record<string, { x: number; y: number }> = {};
  const centers: Record<string, { x: number; y: number }> = {};
  groups.forEach((g, gi) => {
    const a = (gi / groups.length) * Math.PI * 2 - Math.PI / 2;
    const cx = 500 + Math.cos(a) * 260,
      cy = 350 + Math.sin(a) * 220;
    centers[g.c] = { x: cx, y: cy };
    g.items.forEach((x, i) => {
      const b = a + (i - (g.items.length - 1) / 2) * 0.9;
      pos[x] = {
        x: cx + Math.cos(b) * (i ? 70 : 20),
        y: cy + Math.sin(b) * (i ? 60 : 20),
      };
    });
  });

  const people4 = (x: string) => people.filter((p) => p.interests.includes(x));

  const removeNode = async (x: string) => {
    const isCurated = demo.interests.includes(x);
    if (isCurated) {
      const minCheck = validateMinCuratedInterests(demo.interests);
      if (demo.interests.length <= 3 || !minCheck.valid) {
        toast.error("Constellation requires at least 3 curated anchors.");
        return;
      }
    }

    const newInterests = demo.interests.filter((y) => y !== x);
    const newNiche = demo.niche.filter((y) => y !== x);
    setDemo({ interests: newInterests, niche: newNiche });
    if (sel === x) setSel(null);
    toast.success(`Removed "${x}" from constellation.`);

    if (demo.session?.id && !demo.session.demo) {
      await saveUserInterests(demo.session.id, newInterests, newNiche);
    }
  };

  const toggleNodeType = async (x: string) => {
    if (!demo.session?.id || demo.session.demo) {
      const isStandard = demo.interests.includes(x);
      if (isStandard && demo.interests.length <= 3) {
        toast.error("Cannot convert to niche obsession: you need at least 3 curated anchors.");
        return;
      }
      const nextStandard = isStandard
        ? demo.interests.filter((i) => i !== x)
        : [...demo.interests, x];
      const nextNiche = isStandard ? [...demo.niche, x] : demo.niche.filter((i) => i !== x);
      setDemo({ interests: nextStandard, niche: nextNiche });
      toast.success(`Switched "${x}" to ${isStandard ? "niche obsession" : "curated anchor"}.`);
      return;
    }

    const res = await toggleInterestType(demo.session.id, demo.interests, demo.niche, x);
    if (!res.success) {
      toast.error(res.error || "Failed to toggle interest status.");
      return;
    }
    setDemo({ interests: res.standard, niche: res.niche });
    toast.success(`Switched "${x}" status.`);
  };

  const addNode = async () => {
    const v = add.trim();
    if (!v || v.length > 40) return;
    if (all.some((a) => a.toLowerCase() === v.toLowerCase())) {
      toast.error(`"${v}" is already in your constellation.`);
      return;
    }

    const isKnownCurated = Object.values(interestCategories).some((list) =>
      list.some((item) => item.toLowerCase() === v.toLowerCase()),
    );

    let newInterests = demo.interests;
    let newNiche = demo.niche;
    if (isKnownCurated) {
      newInterests = [...demo.interests, v];
    } else {
      newNiche = [...demo.niche, v];
    }

    setDemo({ interests: newInterests, niche: newNiche });
    setAdd("");
    toast.success(`Added "${v}" to your constellation.`);

    if (demo.session?.id && !demo.session.demo) {
      await saveUserInterests(demo.session.id, newInterests, newNiche);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
      toast.error("Invalid image format. Supported formats: JPEG, PNG, WebP.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error("Avatar size exceeds 5MB limit.");
      return;
    }

    if (!demo.session?.id || demo.session.demo) {
      const previewUrl = URL.createObjectURL(file);
      setDemo({
        profile: demo.profile ? { ...demo.profile, avatar_path: previewUrl } : null,
      });
      toast.success("Avatar preview updated!");
      return;
    }

    setUploadingAvatar(true);
    const res = await uploadAvatar(demo.session.id, file);
    setUploadingAvatar(false);

    if (res.error || !res.url) {
      toast.error(res.error || "Failed to upload avatar.");
    } else {
      setDemo({
        profile: demo.profile ? { ...demo.profile, avatar_path: res.url } : null,
      });
      toast.success("Avatar uploaded and updated!");
    }
  };

  const openProfileModal = () => {
    setEditName(displayName);
    setEditHandle(demo.profile?.handle ?? "explorer");
    setEditCity(city);
    setEditBio(bio);
    setEditStyle(conversationStyle);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    const validation = validateProfileUpdates({
      display_name: editName,
      handle: editHandle,
      bio: editBio,
      city: editCity,
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSavingProfile(true);

    if (demo.session?.id && !demo.session.demo) {
      const cleanHandle = editHandle.replace(/^@/, "").trim().toLowerCase();
      const isAvail = await isHandleAvailable(cleanHandle, demo.session.id);
      if (!isAvail) {
        setSavingProfile(false);
        toast.error("Handle is already taken. Please choose another.");
        return;
      }

      const res = await updateProfile(demo.session.id, {
        display_name: editName.trim(),
        handle: cleanHandle,
        city: editCity.trim(),
        bio: editBio.trim(),
        conversation_style: [editStyle],
      });

      if (!res.success) {
        setSavingProfile(false);
        toast.error(res.error || "Failed to update profile.");
        return;
      }
    }

    setDemo({
      profile: demo.profile
        ? {
            ...demo.profile,
            display_name: editName.trim(),
            handle: editHandle.replace(/^@/, "").trim().toLowerCase(),
            city: editCity.trim(),
            bio: editBio.trim(),
            conversation_style: [editStyle],
          }
        : null,
      bio: editBio.trim(),
      city: editCity.trim(),
      styles: [editStyle],
    });

    setSavingProfile(false);
    setProfileModalOpen(false);
    toast.success("Profile updated successfully!");
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete your account? All constellation nodes, profile data, and messages will be permanently deleted.",
      )
    ) {
      return;
    }

    if (demo.session?.id && !demo.session.demo) {
      await deleteUserAccount(demo.session.id);
    }
    resetDemo();
    toast.info("Your account has been deleted.");
    navigate({ to: "/" });
  };

  return (
    <section className="gutter min-h-[100svh] pb-24 pt-32">
      {/* Profile Header */}
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div className="flex items-start gap-6">
          <div className="group relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-20 w-20 rounded-2xl border border-border object-cover sm:h-24 sm:w-24"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-surface-2 font-mono text-2xl font-bold text-signal sm:h-24 sm:w-24">
                {(displayName || "CS").slice(0, 2).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-md transition-colors hover:border-signal hover:text-signal"
              title="Upload new avatar"
              aria-label="Upload new avatar"
            >
              {uploadingAvatar ? (
                <Loader2 size={14} className="animate-spin text-signal" />
              ) : (
                <Camera size={14} />
              )}
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
          </div>

          <div>
            <p className="label-mono text-muted-foreground">Constellation / 002 · Your profile</p>
            <h1 className="display mt-2 break-words text-[clamp(40px,7vw,110px)]">{displayName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="label-mono font-medium text-signal">{handle}</span>
              <span className="label-mono text-muted-foreground">·</span>
              <span className="label-mono text-muted-foreground">{city}</span>
              <span className="label-mono text-muted-foreground">·</span>
              <span className="label-mono rounded border border-border/80 bg-surface/50 px-2 py-0.5 text-muted-foreground">
                {conversationStyle}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={openProfileModal}
            className="btn-ghost flex items-center gap-2 !px-4 !py-2 text-xs"
          >
            <Edit3 size={13} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{bio}</p>

      {/* Constellation Canvas & Sidebar */}
      <div className="mt-14 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="label-mono text-muted-foreground">
              {all.length} nodes · {groups.length} clusters · {demo.interests.length} curated
              anchors
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))}
                className="btn-ghost !px-3 !py-1.5"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
                className="btn-ghost !px-3 !py-1.5"
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setSel(null);
                }}
                className="btn-ghost !px-3 !py-1.5 text-sm"
              >
                <RotateCcw size={14} /> Reset view
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden border border-border bg-surface/30">
            <motion.svg
              viewBox="0 0 1000 700"
              className="w-full"
              animate={{ scale: zoom }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setSel(null)}
            >
              <circle cx={500} cy={350} r={6} className="fill-signal" />
              {groups.map((g) => (
                <g key={g.c}>
                  <motion.line
                    initial={false}
                    animate={{ x2: centers[g.c]!.x, y2: centers[g.c]!.y }}
                    x1={500}
                    y1={350}
                    className="stroke-border"
                    strokeDasharray="3 5"
                  />
                  <motion.text
                    initial={false}
                    animate={{ x: centers[g.c]!.x, y: centers[g.c]!.y - 95 }}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono text-[11px] uppercase tracking-[0.16em]"
                  >
                    {g.c}
                  </motion.text>
                </g>
              ))}
              <AnimatePresence>
                {all.map((x) => {
                  const p = pos[x]!;
                  const c = centers[catOf(x)]!;
                  const on = sel === x || hover === x;
                  const dim = sel && sel !== x && catOf(sel) !== catOf(x);
                  const isNiche = demo.niche.includes(x);

                  return (
                    <motion.g
                      key={x}
                      initial={{ opacity: 0, x: 500, y: 350 }}
                      animate={{ opacity: dim ? 0.25 : 1, x: p.x, y: p.y }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 16,
                      }}
                      onMouseEnter={() => setHover(x)}
                      onMouseLeave={() => setHover(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSel(x);
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={x}
                      onKeyDown={(e) => e.key === "Enter" && setSel(x)}
                      className="cursor-pointer outline-none"
                    >
                      <line
                        x1={0}
                        y1={0}
                        x2={c.x - p.x}
                        y2={c.y - p.y}
                        className={on ? "stroke-signal" : "stroke-muted-foreground"}
                        strokeOpacity={0.4}
                      />
                      <circle r={22} fill="transparent" />
                      <circle
                        r={on ? 9 : 6}
                        className={
                          on
                            ? "fill-signal"
                            : isNiche
                              ? "fill-none stroke-foreground stroke-2"
                              : "fill-foreground"
                        }
                        style={{ transition: "r 200ms" }}
                      />
                      {(on || zoom > 1.1) && (
                        <text
                          y={-16}
                          textAnchor="middle"
                          className="fill-foreground font-mono text-[12px]"
                        >
                          {x}
                        </text>
                      )}
                    </motion.g>
                  );
                })}
              </AnimatePresence>
            </motion.svg>

            {/* Selected Node Drawer / Floating Card */}
            <AnimatePresence>
              {sel && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="absolute bottom-4 left-4 w-[min(320px,calc(100%-2rem))] border border-border bg-background p-5 shadow-2xl"
                >
                  <div className="flex justify-between">
                    <p className="label-mono text-signal">
                      {catOf(sel)}{" "}
                      {demo.niche.includes(sel) ? "· Niche Obsession" : "· Curated Anchor"}
                    </p>
                    <button onClick={() => setSel(null)} aria-label="Close">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="font-display mt-2 text-2xl font-bold">{sel}</p>
                  <p className="label-mono mt-4 text-muted-foreground">Shared by</p>
                  <p className="mt-1 text-sm text-foreground">
                    {people4(sel)
                      .map((p) => p.name)
                      .join(", ") || "Just you in this orbit."}
                  </p>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                    <button
                      onClick={() => toggleNodeType(sel)}
                      className="btn-ghost flex items-center gap-1.5 !px-2.5 !py-1 text-[11px]"
                    >
                      <ArrowLeftRight size={12} />
                      <span>{demo.niche.includes(sel) ? "Make Curated" : "Make Niche"}</span>
                    </button>

                    <button
                      onClick={() => removeNode(sel)}
                      className="btn-ghost flex items-center gap-1.5 !px-2.5 !py-1 text-[11px] text-destructive hover:border-destructive"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar Controls */}
        <aside className="space-y-8 md:col-span-4">
          <div className="border border-border p-5">
            <div className="flex items-center justify-between">
              <p className="label-mono text-muted-foreground">About you</p>
              <button
                onClick={openProfileModal}
                className="label-mono text-signal transition-opacity hover:opacity-80"
              >
                Edit bio
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">{bio}</p>
          </div>

          <div>
            <div className="flex justify-between">
              <p className="label-mono text-muted-foreground">All nodes ({all.length})</p>
              <span className="label-mono text-[10px] text-muted-foreground">
                {demo.interests.length} Curated / {demo.niche.length} Niche
              </span>
            </div>
            <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto border-y border-border">
              {all.map((x) => {
                const isNiche = demo.niche.includes(x);
                return (
                  <li key={x} className="flex items-center justify-between py-2 text-sm">
                    <button
                      onClick={() => setSel(x)}
                      className={`truncate text-left hover:text-signal ${
                        sel === x ? "text-signal" : ""
                      }`}
                    >
                      {x}
                      <span className="label-mono ml-2 text-[10px] text-muted-foreground">
                        {isNiche ? "niche" : "curated"}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleNodeType(x)}
                        title={isNiche ? "Convert to curated anchor" : "Convert to niche obsession"}
                        className="p-1 text-muted-foreground transition-colors hover:text-signal"
                      >
                        <ArrowLeftRight size={13} />
                      </button>
                      <button
                        onClick={() => removeNode(x)}
                        aria-label={`Remove ${x}`}
                        className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="field mt-3">
              <input
                id="addnode"
                placeholder=" "
                value={add}
                maxLength={40}
                onChange={(e) => setAdd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNode()}
              />
              <label htmlFor="addnode">Add an interest or niche + Enter</label>
              <span className="line" />
            </div>
          </div>

          <div>
            <p className="label-mono text-muted-foreground">Conversation Style</p>
            <p className="mt-2 text-sm text-foreground">{conversationStyle}</p>
            <p className="label-mono mt-1 text-[11px] text-muted-foreground">{demo.topics}</p>
          </div>

          <div>
            <p className="label-mono text-muted-foreground">Orbital Overlaps</p>
            <ul className="mt-2 space-y-2 text-sm">
              {people
                .map((p) => ({ p, s: shared(p.interests, all) }))
                .filter((o) => o.s.length)
                .slice(0, 4)
                .map(({ p, s }) => (
                  <li key={p.id} className="border-b border-border/40 pb-1.5 last:border-none">
                    <span className="font-medium text-foreground">{p.name}</span>{" "}
                    <span className="text-xs text-muted-foreground">— {s.join(", ")}</span>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              Edit Profile Parameters
            </DialogTitle>
            <DialogDescription className="label-mono text-xs text-muted-foreground">
              CS // IDENTITY SPECIFICATION
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-5">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={editName}
                    className="h-16 w-16 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-surface-2 font-mono text-lg font-bold text-signal">
                    {(editName || "CS").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="btn-ghost !px-3 !py-1 text-xs"
                >
                  <Camera size={13} />
                  <span>Choose new avatar</span>
                </button>
                <p className="label-mono text-[10px] text-muted-foreground">
                  JPEG, PNG, WebP · Max 5MB
                </p>
              </div>
            </div>

            {/* Display Name */}
            <div className="field">
              <input
                id="edit-display-name"
                placeholder=" "
                value={editName}
                maxLength={60}
                onChange={(e) => setEditName(e.target.value)}
              />
              <label htmlFor="edit-display-name">Display Name</label>
              <span className="line" />
            </div>

            {/* Handle */}
            <div className="field">
              <input
                id="edit-handle"
                placeholder=" "
                value={editHandle}
                maxLength={30}
                onChange={(e) =>
                  setEditHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
              />
              <label htmlFor="edit-handle">Handle (e.g. adasynth)</label>
              <span className="line" />
            </div>

            {/* City */}
            <div className="field">
              <input
                id="edit-city"
                placeholder=" "
                value={editCity}
                maxLength={80}
                onChange={(e) => setEditCity(e.target.value)}
              />
              <label htmlFor="edit-city">City</label>
              <span className="line" />
            </div>

            {/* Bio */}
            <div>
              <div className="mb-1 flex justify-between">
                <label className="label-mono text-xs text-muted-foreground">
                  Bio / Transmission
                </label>
                <span className="label-mono text-xs text-muted-foreground">
                  {editBio.length} / 240
                </span>
              </div>
              <textarea
                value={editBio}
                maxLength={240}
                rows={3}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full border border-input bg-surface/50 p-2.5 text-sm text-foreground outline-none focus:border-signal"
              />
            </div>

            {/* Conversation Style */}
            <div>
              <label className="label-mono mb-2 block text-xs text-muted-foreground">
                Conversation Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CONVERSATION_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setEditStyle(style)}
                    className={`rounded border px-3 py-2 text-left text-xs transition-colors ${
                      editStyle === style
                        ? "border-signal bg-signal/10 font-semibold text-signal"
                        : "border-border bg-surface/40 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="btn-ghost !px-4 !py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleSaveProfile}
                className="btn-signal !px-5 !py-2 text-xs"
              >
                {savingProfile ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-destructive/20 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-mono text-xs text-destructive">Danger Zone</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your profile and constellation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="btn-ghost flex items-center gap-1.5 !px-3 !py-1 text-xs text-destructive hover:border-destructive hover:bg-destructive/10"
                >
                  <AlertTriangle size={12} />
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
