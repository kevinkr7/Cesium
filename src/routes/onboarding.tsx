import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowLeft, X } from "lucide-react";
import { interestCategories } from "@/lib/data";
import { setDemo, useDemo } from "@/lib/store";
import { fetchAllInterests, saveUserInterests } from "@/services/interests";
import { updateProfile } from "@/services/profiles";

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
    <RequireAuth>
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
  const [picked, setPicked] = useState<string[]>([]);
  const [niche, setNiche] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [bio, setBio] = useState("");
  const [topics, setTopics] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

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
    setReady(true);
  }, [demo, ready]);

  useEffect(() => {
    if (ready) setDemo({ interests: picked, niche, bio, topics, styles });
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
  const canNext = step === 1 ? picked.length >= 3 : true;

  const finish = async () => {
    setDemo({ onboarded: true, interests: picked, niche, bio, topics, styles });
    if (demo.session?.id && !demo.session.demo) {
      await saveUserInterests(demo.session.id, picked, niche);
      await updateProfile(demo.session.id, {
        bio,
        topics,
        conversation_style: styles,
        onboarding_completed: true,
      });
    }
    setStep(4);
  };

  return (
    <section className="gutter min-h-[100svh] pb-20 pt-32">
      <div className="mb-10 flex items-center justify-between">
        <p className="label-mono text-signal">
          {String(Math.min(step + 1, 4)).padStart(2, "0")} / 04
        </p>
        <div className="flex h-px w-1/2 bg-border">
          <motion.div
            className="h-px bg-signal"
            animate={{ width: `${(Math.min(step + 1, 4) / 4) * 100}%` }}
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
              {step === 0 && (
                <div>
                  <h1 className="display text-[clamp(52px,8vw,128px)]">
                    Let's find your frequency.
                  </h1>
                  <p className="mt-6 max-w-lg text-lg text-muted-foreground">
                    Over the next three steps you'll assemble a small universe of the things you
                    care about. It takes about a minute. Nothing here is permanent.
                  </p>
                </div>
              )}
              {step === 1 && (
                <div>
                  <h1 className="display text-5xl md:text-7xl">What pulls you in?</h1>
                  <p className="mt-3 text-muted-foreground">
                    Pick at least three.{" "}
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
              {step === 2 && (
                <div>
                  <h1 className="display text-5xl md:text-7xl">
                    What could you talk about for hours?
                  </h1>
                  <p className="mt-3 text-muted-foreground">
                    Type anything and press Enter. The weirder, the better.
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
                  <p className="label-mono mt-10 text-muted-foreground">Suggestions</p>
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
              {step === 3 && (
                <div>
                  <h1 className="display text-5xl md:text-7xl">How do you like to talk?</h1>
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
                    <p className="label-mono text-muted-foreground">
                      Avatar upload arrives later — optional, skip freely.
                    </p>
                  </div>
                </div>
              )}
              {step === 4 && (
                <div>
                  <p className="label-mono text-signal">Constellation complete</p>
                  <h1 className="display mt-4 text-[clamp(52px,8vw,128px)]">
                    Your universe is ready.
                  </h1>
                  <p className="mt-4 text-muted-foreground">
                    {all.length} interests, mapped and waiting for overlaps.
                  </p>
                  <Link to="/discover" className="btn-signal mt-10">
                    <span>Start discovering</span>
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
                disabled={!canNext}
                onClick={() => (step === 3 ? finish() : setStep(step + 1))}
                className="btn-signal"
              >
                <span>{step === 0 ? "Begin" : step === 3 ? "Assemble universe" : "Continue"}</span>
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
            <p className="label-mono text-muted-foreground">Live preview</p>
            <MiniConstellation items={all} />
            {step >= 3 && (
              <div className="border-t border-border pt-4">
                <p className="font-display text-xl font-semibold">{demo.session?.name ?? "You"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {bio || "Your bio will appear here."}
                </p>
                <p className="label-mono mt-3 text-muted-foreground">{styles.join(" · ")}</p>
              </div>
            )}
            <p className="label-mono mt-2 text-muted-foreground">{all.length} nodes</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
