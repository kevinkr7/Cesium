import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useRef } from "react";
import { ArrowUpRight, ArrowLeft, X, Check, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { interestCategories, people } from "@/lib/data";
import { setDemo, useDemo } from "@/lib/store";
import { fetchAllInterests, saveUserInterests } from "@/services/interests";
import { updateProfile, isHandleAvailable, uploadAvatar } from "@/services/profiles";
import { computeMatchScore } from "@/services/discovery";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Build your universe — Cesium" },
      {
        name: "description",
        content: "Pick your interests and niche obsessions to build your Cesium constellation.",
      },
      { property: "og:title", content: "Build your universe — Cesium" },
      { property: "og:description", content: "Let's find your frequency." },
    ],
  }),
  component: () => (
    <RequireAuth requireOnboarded={false}>
      <Onboarding />
    </RequireAuth>
  ),
});

const styleOpts = [
  "Slow & thoughtful",
  "Rapid-fire ideas",
  "Voice notes",
  "Deep dives",
  "Show, don't tell",
];
const ease = [0.16, 1, 0.3, 1] as const;

function MiniConstellation({ items }: { items: string[] }) {
  const pts = items.map((_, i) => {
    const a = i * 2.39996,
      r = 18 + Math.sqrt(i) * 26;
    return { x: 150 + Math.cos(a) * r, y: 150 + Math.sin(a) * r };
  });
  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full"
      aria-label={`${items.length} interests in your constellation`}
    >
      <circle cx={150} cy={150} r={4} className="fill-signal" />
      {pts.map((p, i) => (
        <motion.g
          key={items[i]}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          style={{ transformOrigin: `${p.x}px ${p.y}px` }}
        >
          <line
            x1={150}
            y1={150}
            x2={p.x}
            y2={p.y}
            className="stroke-muted-foreground"
            strokeOpacity={0.3}
          />
          {i > 0 && (
            <line
              x1={pts[i - 1]!.x}
              y1={pts[i - 1]!.y}
              x2={p.x}
              y2={p.y}
              className="stroke-signal"
              strokeOpacity={0.25}
            />
          )}
          <circle cx={p.x} cy={p.y} r={3 + (i % 3)} className="fill-foreground" />
        </motion.g>
      ))}
    </svg>
  );
}

function Onboarding() {
  const demo = useDemo();
  const [categories, setCategories] = useState<Record<string, string[]>>(interestCategories);
  const [step, setStep] = useState(0);

  // Step 0: Identity
  const [displayName, setDisplayName] = useState(demo.session?.name ?? "");
  const [handle, setHandle] = useState(() => {
    const defaultName = demo.session?.name ?? "visitor";
    return (
      "@" +
      defaultName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 20)
    );
  });
  const [city, setCity] = useState("Bengaluru");
  const [handleErr, setHandleErr] = useState("");
  const [handleChecking, setHandleChecking] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid image format", {
        description: "Please choose a JPEG, PNG, or WebP image.",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeded", {
        description: "Profile picture must be under 5MB.",
      });
      return;
    }
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  // Step 1: Curated Interests
  const [picked, setPicked] = useState<string[]>([]);

  // Step 2: Niche Obsessions
  const [niche, setNiche] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  // Step 3: Conversation Style & Bio
  const [bio, setBio] = useState("");
  const [topics, setTopics] = useState("");
  const [styles, setStyles] = useState<string[]>([]);

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllInterests().then(setCategories);
  }, []);

  useEffect(() => {
    if (ready) return;
    setPicked(demo.onboarded ? demo.interests : []);
    setNiche(demo.niche);
    setBio(demo.bio);
    setTopics(demo.topics);
    setStyles(demo.styles);
    if (demo.session?.name) {
      setDisplayName(demo.session.name);
    }
    setReady(true);
  }, [demo, ready]);

  useEffect(() => {
    if (ready) {
      setDemo({ interests: picked, niche, bio, topics, styles });
    }
  }, [picked, niche, bio, topics, styles, ready]);

  const all = [...picked, ...niche];

  const toggle = (x: string) =>
    setPicked((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]));

  const addNiche = () => {
    const v = draft.trim();
    if (!v) return;
    if (v.length > 40) return setErr("Keep it under 40 characters");
    if (all.some((a) => a.toLowerCase() === v.toLowerCase()))
      return setErr("Already in your universe");
    setNiche((n) => [...n, v]);
    setDraft("");
    setErr("");
  };

  const validateIdentity = async () => {
    if (!displayName.trim()) {
      setHandleErr("Please enter a display name");
      return;
    }
    const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
    if (cleanHandle.length < 2 || cleanHandle.length > 30) {
      setHandleErr("Handle must be between 2 and 30 characters");
      return;
    }

    setHandleChecking(true);
    const available = await isHandleAvailable(cleanHandle, demo.session?.id);
    setHandleChecking(false);

    if (!available) {
      setHandleErr("This handle is already claimed. Choose another.");
      return;
    }

    setHandleErr("");
    setDemo((prev) => ({
      session: prev.session ? { ...prev.session, name: displayName.trim() } : null,
    }));
    setStep(1);
  };

  const finish = async () => {
    setSaving(true);
    const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();

    setDemo({
      onboarded: true,
      interests: picked,
      niche,
      bio,
      topics,
      styles,
    });

    if (demo.session?.id && !demo.session.demo) {
      let avatarPath: string | undefined = undefined;
      if (avatarFile) {
        const uploadRes = await uploadAvatar(demo.session.id, avatarFile);
        if (uploadRes.url) {
          avatarPath = uploadRes.url;
        }
      }

      await saveUserInterests(demo.session.id, picked, niche);
      await updateProfile(demo.session.id, {
        handle: cleanHandle,
        display_name: displayName.trim() || demo.session.name,
        city: city.trim(),
        bio,
        topics,
        conversation_style: styles,
        onboarding_completed: true,
        ...(avatarPath ? { avatar_path: avatarPath } : {}),
      });
      if (avatarPath) {
        setDemo((s) => ({
          profile: s.profile ? { ...s.profile, avatar_path: avatarPath } : null,
        }));
      }
    }

    setSaving(false);
    setStep(4);
  };

  // Find the top first discovery match for Step 4
  const topMatch = people
    .map((person) => {
      const match = computeMatchScore(all, person.interests, picked);
      return { person, ...match };
    })
    .sort((a, b) => b.score - a.score)[0];

  const canNext = step === 1 ? picked.length >= 3 : true;

  return (
    <section className="gutter min-h-[100svh] pb-20 pt-32">
      <div className="mb-10 flex items-center justify-between">
        <p className="label-mono text-signal">
          {String(Math.min(step + 1, 5)).padStart(2, "0")} / 05
        </p>
        <div className="flex h-px w-1/2 bg-border">
          <motion.div
            className="h-px bg-signal"
            animate={{ width: `${(Math.min(step + 1, 5) / 5) * 100}%` }}
            transition={{ duration: 0.6, ease }}
          />
        </div>
      </div>

      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.45, ease }}
            >
              {/* Step 0: Handle & Identity */}
              {step === 0 && (
                <div>
                  <p className="label-mono text-signal">01 // Identity & Home Orbit</p>
                  <h1 className="display mt-3 text-5xl md:text-7xl">
                    Who are you in this universe?
                  </h1>
                  <p className="mt-3 text-muted-foreground">
                    Choose your display name, unique handle, and home orbit.
                  </p>
                  <div className="mt-8 max-w-xl space-y-6">
                    <div className="field">
                      <input
                        id="display-name"
                        placeholder=" "
                        value={displayName}
                        maxLength={60}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                      <label htmlFor="display-name">Display name</label>
                      <span className="line" />
                    </div>
                    <div className="field" data-invalid={!!handleErr}>
                      <input
                        id="handle"
                        placeholder=" "
                        value={handle}
                        maxLength={30}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith("@")) val = "@" + val;
                          setHandle(val.toLowerCase().replace(/[^a-z0-9_@]/g, ""));
                          setHandleErr("");
                        }}
                      />
                      <label htmlFor="handle">Handle (@username)</label>
                      <span className="line" />
                      {handleErr && (
                        <p className="label-mono mt-2 text-destructive">↳ {handleErr}</p>
                      )}
                    </div>
                    <div className="field">
                      <input
                        id="city"
                        placeholder=" "
                        value={city}
                        maxLength={60}
                        onChange={(e) => setCity(e.target.value)}
                      />
                      <label htmlFor="city">City / Current orbit</label>
                      <span className="line" />
                    </div>

                    {/* Profile Picture (Optional) */}
                    <div className="flex items-center gap-5 pt-3">
                      <div
                        onClick={() => avatarInputRef.current?.click()}
                        className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-surface/40 transition-all hover:border-signal/60"
                        title="Upload profile picture (optional)"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            avatarInputRef.current?.click();
                          }
                        }}
                      >
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center">
                            <Upload
                              size={18}
                              className="text-muted-foreground transition-colors group-hover:text-signal"
                            />
                            <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                              Add
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            Profile Picture
                          </span>
                          <span className="label-mono rounded bg-surface px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            Optional
                          </span>
                        </div>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          JPEG, PNG, or WebP up to 5MB. You can skip this or add one later.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            className="btn-ghost !px-2.5 !py-1 text-xs text-signal hover:text-signal"
                          >
                            {avatarPreview ? "Change photo" : "Select image"}
                          </button>
                          {avatarPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setAvatarFile(null);
                                setAvatarPreview(null);
                              }}
                              className="btn-ghost !px-2 !py-1 text-xs text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleAvatarSelect}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Select 3+ Curated Interests */}
              {step === 1 && (
                <div>
                  <p className="label-mono text-signal">02 // Core Constellation</p>
                  <h1 className="display mt-3 text-5xl md:text-7xl">What pulls you in?</h1>
                  <p className="mt-3 text-muted-foreground">
                    Pick at least three core interests.{" "}
                    <span className="text-signal">{picked.length} selected</span>
                  </p>
                  <div className="mt-10 space-y-7">
                    {Object.entries(categories).map(([cat, list]) => (
                      <div key={cat}>
                        <p className="label-mono mb-3 text-muted-foreground">{cat}</p>
                        <div className="flex flex-wrap gap-2">
                          {list.map((x) => (
                            <motion.button
                              key={x}
                              whileTap={{ scale: 0.94 }}
                              onClick={() => toggle(x)}
                              data-on={picked.includes(x)}
                              aria-pressed={picked.includes(x)}
                              className="chip hover:border-foreground/40"
                            >
                              {picked.includes(x) && (
                                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                              )}
                              {x}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Personal Constellation (Niche Obsessions) */}
              {step === 2 && (
                <div>
                  <p className="label-mono text-signal">03 // Personal Constellation</p>
                  <h1 className="display mt-3 text-5xl md:text-7xl">
                    What could you talk about for hours?
                  </h1>
                  <p className="mt-3 text-muted-foreground">
                    Type your specific obsessions and press Enter. The weirder, the better.
                  </p>
                  <div className="field mt-10 max-w-xl" data-invalid={!!err}>
                    <input
                      id="niche"
                      placeholder=" "
                      value={draft}
                      maxLength={60}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setErr("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNiche();
                        }
                      }}
                    />
                    <label htmlFor="niche">e.g. The history of elevator buttons</label>
                    <span className="line" />
                    {err && <p className="label-mono mt-2 text-destructive">↳ {err}</p>}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <AnimatePresence>
                      {niche.map((n) => (
                        <motion.span
                          key={n}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="chip"
                          data-on="true"
                        >
                          {n}
                          <button
                            onClick={() => setNiche((s) => s.filter((x) => x !== n))}
                            aria-label={`Remove ${n}`}
                          >
                            <X size={12} />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                  <p className="label-mono mt-10 text-muted-foreground">Curated suggestions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Lighthouse architecture",
                      "Medieval marginalia",
                      "Cloud classification",
                      "Obsolete units",
                    ]
                      .filter((s) => !niche.includes(s))
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => setNiche((n) => [...n, s])}
                          className="chip text-muted-foreground hover:text-foreground"
                        >
                          + {s}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Step 3: Conversation Style & Bio */}
              {step === 3 && (
                <div>
                  <p className="label-mono text-signal">04 // Resonance & Cadence</p>
                  <h1 className="display mt-3 text-5xl md:text-7xl">How do you like to talk?</h1>
                  <div className="mt-10 max-w-xl space-y-8">
                    <div>
                      <label htmlFor="bio" className="label-mono text-muted-foreground">
                        Short bio <span className="normal-case">({bio.length}/160)</span>
                      </label>
                      <textarea
                        id="bio"
                        maxLength={160}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        placeholder="Tell others what you build, photograph, or collect…"
                        className="mt-2 w-full border border-input bg-transparent p-3 outline-none focus:border-signal"
                      />
                    </div>
                    <div className="field">
                      <input
                        id="topics"
                        placeholder=" "
                        value={topics}
                        maxLength={80}
                        onChange={(e) => setTopics(e.target.value)}
                      />
                      <label htmlFor="topics">Preferred conversation topics</label>
                      <span className="line" />
                    </div>
                    <div>
                      <p className="label-mono mb-3 text-muted-foreground">Conversation style</p>
                      <div className="flex flex-wrap gap-2">
                        {styleOpts.map((s) => (
                          <button
                            key={s}
                            onClick={() =>
                              setStyles((x) =>
                                x.includes(s) ? x.filter((y) => y !== s) : [...x, s],
                              )
                            }
                            data-on={styles.includes(s)}
                            aria-pressed={styles.includes(s)}
                            className="chip"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: First Discovery Overlap */}
              {step === 4 && (
                <div>
                  <p className="label-mono text-signal">05 // Constellation Complete</p>
                  <h1 className="display mt-3 text-[clamp(44px,6vw,96px)]">
                    Your universe is ready.
                  </h1>
                  <p className="mt-3 text-lg text-muted-foreground">
                    {all.length} interests mapped and calibrated into your constellation.
                  </p>

                  {topMatch && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="mt-8 max-w-xl rounded-xl border border-border bg-card/60 p-6 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-display text-2xl font-bold">{topMatch.person.name}</p>
                          <p className="label-mono text-sm text-muted-foreground">
                            {topMatch.person.handle} · {topMatch.person.city}
                          </p>
                        </div>
                        <span className="chip text-signal font-mono" data-on="true">
                          <Sparkles size={13} className="mr-1 inline text-signal" />
                          {topMatch.score}% overlap
                        </span>
                      </div>
                      <p className="mt-4 text-sm text-foreground/90">{topMatch.explanation}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {topMatch.sharedList.map((tag) => (
                          <span key={tag} className="chip text-xs">
                            <Check size={10} className="mr-1 inline text-signal" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <Link to="/discover" className="btn-signal mt-8 inline-flex items-center gap-2">
                    <span>Enter discovery feed</span>
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {step < 4 && (
            <div className="mt-14 flex flex-wrap items-center gap-3">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className="btn-ghost">
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              <button
                disabled={step === 0 ? handleChecking || !displayName.trim() : !canNext || saving}
                onClick={() => {
                  if (step === 0) {
                    validateIdentity();
                  } else if (step === 3) {
                    finish();
                  } else {
                    setStep(step + 1);
                  }
                }}
                className="btn-signal"
              >
                <span>
                  {step === 0
                    ? handleChecking
                      ? "Verifying…"
                      : "Continue"
                    : step === 3
                      ? saving
                        ? "Assembling…"
                        : "Assemble universe"
                      : "Continue"}
                </span>
                <ArrowUpRight size={18} />
              </button>
              {(step === 2 || step === 3) && (
                <button
                  onClick={() => (step === 3 ? finish() : setStep(3))}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip this step
                </button>
              )}
              {step === 1 && !canNext && (
                <p className="label-mono text-muted-foreground">
                  {3 - picked.length} more to continue
                </p>
              )}
            </div>
          )}
        </div>

        <aside className="md:col-span-4">
          <div className="sticky top-28 border border-border p-5">
            <p className="label-mono text-muted-foreground">Live Constellation Preview</p>
            <MiniConstellation items={all} />
            <div className="border-t border-border pt-4">
              <p className="font-display text-xl font-semibold">{displayName || "Your Name"}</p>
              <p className="label-mono text-sm text-signal">
                {handle} · {city}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {bio || "Your short bio will appear here."}
              </p>
              {styles.length > 0 && (
                <p className="label-mono mt-3 text-xs text-muted-foreground">
                  {styles.join(" · ")}
                </p>
              )}
            </div>
            <p className="label-mono mt-3 text-muted-foreground">{all.length} nodes</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
