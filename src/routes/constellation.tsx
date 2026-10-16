import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { interestCategories, people, shared } from "@/lib/data";
import { setDemo, useDemo } from "@/lib/store";
import { saveUserInterests } from "@/services/interests";
import { updateProfile } from "@/services/profiles";

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

const catOf = (x: string) =>
  Object.entries(interestCategories).find(([, l]) => l.includes(x))?.[0] ?? "Niche";
const cats = [...Object.keys(interestCategories), "Niche"];

function Constellation() {
  const demo = useDemo();
  const all = [...demo.interests, ...demo.niche];
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(demo.bio);
  const [add, setAdd] = useState("");
  const name = demo.session?.name ?? "Demo Visitor";

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
      pos[x] = { x: cx + Math.cos(b) * (i ? 70 : 20), y: cy + Math.sin(b) * (i ? 60 : 20) };
    });
  });

  const people4 = (x: string) => people.filter((p) => p.interests.includes(x));

  const remove = (x: string) => {
    const newInterests = demo.interests.filter((y) => y !== x);
    const newNiche = demo.niche.filter((y) => y !== x);
    setDemo({ interests: newInterests, niche: newNiche });
    setSel(null);
    if (demo.session?.id && !demo.session.demo) {
      saveUserInterests(demo.session.id, newInterests, newNiche);
    }
  };

  const addNode = () => {
    const v = add.trim();
    if (!v || v.length > 40 || all.some((a) => a.toLowerCase() === v.toLowerCase())) return;
    const newNiche = [...demo.niche, v];
    setDemo({ niche: newNiche });
    setAdd("");
    if (demo.session?.id && !demo.session.demo) {
      saveUserInterests(demo.session.id, demo.interests, newNiche);
    }
  };

  const saveBio = () => {
    setDemo({ bio });
    setEditing(false);
    if (demo.session?.id && !demo.session.demo) {
      updateProfile(demo.session.id, { bio });
    }
  };

  return (
    <section className="gutter min-h-[100svh] pb-24 pt-32">
      <p className="label-mono text-muted-foreground">Constellation / 002 · Your profile</p>
      <h1 className="display mt-4 break-words text-[clamp(56px,11vw,180px)]">{name}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">{demo.bio}</p>

      <div className="mt-14 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="label-mono text-muted-foreground">
              {all.length} nodes · {groups.length} clusters
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
                  return (
                    <motion.g
                      key={x}
                      initial={{ opacity: 0, x: 500, y: 350 }}
                      animate={{ opacity: dim ? 0.25 : 1, x: p.x, y: p.y }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ type: "spring", stiffness: 120, damping: 16 }}
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
                            : demo.niche.includes(x)
                              ? "fill-none stroke-foreground"
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
            <AnimatePresence>
              {sel && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="absolute bottom-4 left-4 w-[min(300px,calc(100%-2rem))] border border-border bg-background p-5"
                >
                  <div className="flex justify-between">
                    <p className="label-mono text-signal">{catOf(sel)}</p>
                    <button onClick={() => setSel(null)} aria-label="Close">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="font-display mt-2 text-2xl font-bold">{sel}</p>
                  <p className="label-mono mt-4 text-muted-foreground">Shared by</p>
                  <p className="mt-1 text-sm">
                    {people4(sel)
                      .map((p) => p.name)
                      .join(", ") || "Just you in this orbit."}
                  </p>
                  <button
                    onClick={() => remove(sel)}
                    className="btn-ghost mt-4 !py-1.5 text-xs text-destructive"
                  >
                    Remove node
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <aside className="space-y-8 md:col-span-4">
          <div className="border border-border p-5">
            <div className="flex items-center justify-between">
              <p className="label-mono text-muted-foreground">About you</p>
              <button
                onClick={() => (editing ? saveBio() : setEditing(true))}
                className="label-mono text-signal"
              >
                {editing ? "Save" : "Edit bio"}
              </button>
            </div>
            {editing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                className="mt-3 w-full border border-input bg-transparent p-2 text-sm outline-none focus:border-signal"
              />
            ) : (
              <p className="mt-3 text-sm">{demo.bio}</p>
            )}
          </div>
          <div>
            <div className="flex justify-between">
              <p className="label-mono text-muted-foreground">All nodes ({all.length})</p>
            </div>
            <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto border-y border-border">
              {all.map((x) => (
                <li key={x} className="flex items-center justify-between py-2 text-sm">
                  <button
                    onClick={() => setSel(x)}
                    className={`text-left hover:text-signal ${sel === x ? "text-signal" : ""}`}
                  >
                    {x}
                    {demo.niche.includes(x) && (
                      <span className="label-mono ml-2 text-muted-foreground">niche</span>
                    )}
                  </button>
                  <button
                    onClick={() => remove(x)}
                    aria-label={`Remove ${x}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
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
              <label htmlFor="addnode">Add a node + Enter</label>
              <span className="line" />
            </div>
          </div>
          <div>
            <p className="label-mono text-muted-foreground">Conversation</p>
            <p className="mt-2 text-sm">{demo.topics}</p>
            <p className="label-mono mt-1 text-muted-foreground">{demo.styles.join(" · ")}</p>
          </div>
          <div>
            <p className="label-mono text-muted-foreground">Overlaps</p>
            <ul className="mt-2 space-y-1 text-sm">
              {people
                .map((p) => ({ p, s: shared(p.interests, all) }))
                .filter((o) => o.s.length)
                .slice(0, 4)
                .map(({ p, s }) => (
                  <li key={p.id}>
                    <span className="font-medium">{p.name}</span>{" "}
                    <span className="text-muted-foreground">— {s.join(", ")}</span>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
