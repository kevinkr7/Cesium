import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

type GNode = { id: string; x: number; y: number; r: number; ring?: boolean; people: number };
const mine: GNode[] = [
  { id: "Creative coding", x: 480, y: 280, r: 14, ring: true, people: 12 },
  { id: "Astronomy", x: 720, y: 160, r: 10, people: 31 },
  { id: "Ambient music", x: 260, y: 140, r: 9, people: 18 },
  { id: "Film photography", x: 220, y: 400, r: 11, ring: true, people: 24 },
  { id: "Indie cinema", x: 520, y: 500, r: 8, people: 40 },
  { id: "Synthesizers", x: 760, y: 420, r: 7, people: 9 },
  { id: "Typography", x: 90, y: 260, r: 6, people: 15 },
  { id: "Weather maps", x: 900, y: 290, r: 5, people: 4 },
];
const sharedNodes: GNode[] = [
  { id: "Creative coding", x: 380, y: 240, r: 16, ring: true, people: 12 },
  { id: "Astronomy", x: 600, y: 230, r: 14, ring: true, people: 31 },
  { id: "Ambient music", x: 300, y: 430, r: 10, people: 18 },
  { id: "Indie cinema", x: 700, y: 440, r: 9, people: 40 },
  { id: "Synthesizers", x: 500, y: 450, r: 8, people: 9 },
];
const edges: [string, string, string][] = [
  [
    "Creative coding",
    "Astronomy",
    "Both reward patient, systematic wonder — people often simulate the sky they observe.",
  ],
  [
    "Creative coding",
    "Synthesizers",
    "Signal and code share a language: oscillators, loops, feedback.",
  ],
  ["Ambient music", "Synthesizers", "Most ambient records are built on the same patch cables."],
  ["Film photography", "Indie cinema", "A shared obsession with grain, light and slowness."],
  ["Film photography", "Typography", "Both are crafts of careful framing."],
  ["Astronomy", "Weather maps", "Looking up, then mapping what you see."],
  [
    "Ambient music",
    "Film photography",
    "Mood-first art forms; people here trade playlists for photo walks.",
  ],
  ["Indie cinema", "Ambient music", "Soundtracks are a common bridge."],
];

export function InterestGraph() {
  const [mode, setMode] = useState<"mine" | "shared">("mine");
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const nodes = mode === "mine" ? mine : sharedNodes;
  const ids = new Set(nodes.map((n) => n.id));
  const visEdges = edges.filter(([a, b]) => ids.has(a) && ids.has(b));
  const neighbours = (id: string) =>
    visEdges.filter((e) => e[0] === id || e[1] === id).map((e) => (e[0] === id ? e[1] : e[0]));
  const focus = hover ?? sel[sel.length - 1] ?? null;
  const lit = useMemo(() => (focus ? new Set([focus, ...neighbours(focus)]) : null), [focus, mode]); // eslint-disable-line
  const pair =
    sel.length === 2 ? visEdges.find((e) => sel.includes(e[0]) && sel.includes(e[1])) : undefined;
  const active = nodes.find((n) => n.id === sel[sel.length - 1]);

  const click = (id: string) => {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id]));
  };

  return (
    <div className="relative">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="inline-flex border border-border p-1">
          {(["mine", "shared"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setSel([]);
              }}
              className={`relative px-4 py-2 text-sm transition-colors ${mode === m ? "text-ink" : "text-muted-foreground hover:text-foreground"}`}
            >
              {mode === m && (
                <motion.span
                  layoutId="graph-tab"
                  className="absolute inset-0 bg-signal"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative">{m === "mine" ? "My interests" : "Shared interests"}</span>
            </button>
          ))}
        </div>
        <p className="label-mono text-muted-foreground">Select two nodes to read their bond</p>
      </div>

      <div
        className="relative border border-border bg-surface/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSel([]);
        }}
      >
        <svg
          viewBox="0 0 1000 600"
          className="w-full"
          onClick={(e) => {
            if ((e.target as Element).tagName === "svg") setSel([]);
          }}
        >
          {[...Array(9)].map((_, i) => (
            <line
              key={i}
              x1={i * 125}
              y1={0}
              x2={i * 125}
              y2={600}
              className="stroke-border"
              strokeDasharray="2 6"
            />
          ))}
          {visEdges.map(([a, b]) => {
            const A = nodes.find((n) => n.id === a)!,
              B = nodes.find((n) => n.id === b)!;
            const on = lit ? lit.has(a) && lit.has(b) && (a === focus || b === focus) : false;
            const isPair = pair && pair[0] === a && pair[1] === b;
            return (
              <motion.path
                key={a + b}
                initial={false}
                animate={{
                  d: `M${A.x},${A.y} Q${(A.x + B.x) / 2},${(A.y + B.y) / 2 - 60} ${B.x},${B.y}`,
                }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                fill="none"
                strokeWidth={isPair ? 2 : 1}
                className={on || isPair ? "stroke-signal" : "stroke-muted-foreground"}
                strokeOpacity={lit && !on && !isPair ? 0.12 : 0.5}
              />
            );
          })}
          {nodes.map((n) => {
            const dim = lit && !lit.has(n.id);
            const isSel = sel.includes(n.id);
            return (
              <motion.g
                key={n.id}
                initial={{ opacity: 0 }}
                animate={{ x: n.x, y: n.y, opacity: dim ? 0.25 : 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  click(n.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    click(n.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSel}
                aria-label={`${n.id}, ${n.people} people`}
                className="cursor-pointer outline-none"
              >
                <circle r={40} fill="transparent" />
                {n.ring ? (
                  <circle
                    r={n.r * (hover === n.id ? 1.25 : 1)}
                    fill="none"
                    strokeWidth={1.5}
                    className={isSel ? "stroke-signal" : "stroke-foreground"}
                    style={{ transition: "r 200ms" }}
                  />
                ) : (
                  <circle
                    r={n.r * (hover === n.id ? 1.25 : 1)}
                    className={isSel ? "fill-signal" : "fill-foreground"}
                    style={{ transition: "r 200ms" }}
                  />
                )}
                {n.r > 9 && (
                  <circle
                    r={n.r + 8}
                    fill="none"
                    className="stroke-muted-foreground"
                    strokeDasharray="1 5"
                  />
                )}
                <text
                  y={n.r + 24}
                  textAnchor="middle"
                  className={`font-mono text-[12px] uppercase tracking-[0.14em] ${isSel ? "fill-signal" : "fill-foreground"}`}
                >
                  {n.id}
                </text>
              </motion.g>
            );
          })}
        </svg>

        <AnimatePresence mode="wait">
          {active && (
            <motion.aside
              key={active.id + (pair ? "p" : "")}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-4 right-4 w-[min(320px,calc(100%-2rem))] border border-border bg-background p-5"
            >
              {pair ? (
                <>
                  <p className="label-mono text-signal">Bond detected</p>
                  <p className="mt-2 font-display text-lg font-semibold">
                    {pair[0]} × {pair[1]}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{pair[2]}</p>
                </>
              ) : (
                <>
                  <p className="label-mono text-signal">{active.id}</p>
                  <p className="label-mono mt-3 text-muted-foreground">
                    Connected to {neighbours(active.id).length} interests
                  </p>
                  <p className="label-mono mt-1 text-muted-foreground">
                    {active.people} people share this interest
                  </p>
                  {sel.length === 2 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No direct bond yet — that's what makes it interesting.
                    </p>
                  )}
                </>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
