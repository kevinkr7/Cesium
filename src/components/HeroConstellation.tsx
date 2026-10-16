import { useEffect, useRef, useState, useMemo } from "react";
import { motion, useScroll, useTransform } from "motion/react";

export type ConstellationCluster = "audio" | "computation" | "atmosphere";

export type ConstellationNode = {
  id: string;
  cluster: ConstellationCluster;
  x: number; // Base SVG X (coordinate space: 1200 x 820)
  y: number; // Base SVG Y
  r: number; // Radius
  label: string;
  initialLabel?: boolean; // Only 4-5 labels visible initially
  ring?: boolean; // Subtle outer orbit ring
  driftPhase: number;
  driftSpeed: number;
  driftAmp: number;
};

// 13 meaningful nodes in 3 intentional clusters living in perimeter negative space
const nodes: ConstellationNode[] = [
  // Cluster 1: Audio Archeology & Synthesis (Top-Left Negative Space: x: 130-380, y: 100-220)
  {
    id: "synths",
    cluster: "audio",
    label: "Analog synths",
    x: 200,
    y: 130,
    r: 5,
    initialLabel: true,
    ring: true,
    driftPhase: 0.2,
    driftSpeed: 0.15,
    driftAmp: 5,
  },
  {
    id: "modular",
    cluster: "audio",
    label: "Modular synthesis",
    x: 330,
    y: 95,
    r: 4,
    driftPhase: 1.4,
    driftSpeed: 0.12,
    driftAmp: 4.5,
  },
  {
    id: "tape",
    cluster: "audio",
    label: "Tape loops",
    x: 375,
    y: 190,
    r: 3.5,
    driftPhase: 2.7,
    driftSpeed: 0.18,
    driftAmp: 5.5,
  },
  {
    id: "field",
    cluster: "audio",
    label: "Field recording",
    x: 130,
    y: 215,
    r: 4,
    driftPhase: 3.8,
    driftSpeed: 0.14,
    driftAmp: 4,
  },

  // Cluster 2: Computation & Cosmos (Top-Right Negative Space: x: 730-1080, y: 80-190)
  {
    id: "genart",
    cluster: "computation",
    label: "Generative art",
    x: 820,
    y: 110,
    r: 5.5,
    initialLabel: true,
    ring: true,
    driftPhase: 4.5,
    driftSpeed: 0.16,
    driftAmp: 5,
  },
  {
    id: "code",
    cluster: "computation",
    label: "Creative coding",
    x: 960,
    y: 85,
    r: 4.5,
    driftPhase: 0.9,
    driftSpeed: 0.13,
    driftAmp: 4,
  },
  {
    id: "stars",
    cluster: "computation",
    label: "Stargazing",
    x: 1070,
    y: 145,
    r: 4,
    driftPhase: 2.1,
    driftSpeed: 0.17,
    driftAmp: 4.5,
  },
  {
    id: "solarpunk",
    cluster: "computation",
    label: "Solarpunk",
    x: 730,
    y: 180,
    r: 4.5,
    driftPhase: 5.2,
    driftSpeed: 0.15,
    driftAmp: 5,
  },

  // Cluster 3: Atmosphere & Obscure Cinema (Lower-Right Negative Space: x: 670-1070, y: 550-730)
  {
    id: "ambient",
    cluster: "atmosphere",
    label: "Ambient music",
    x: 670,
    y: 560,
    r: 5.5,
    initialLabel: true,
    ring: true,
    driftPhase: 1.1,
    driftSpeed: 0.14,
    driftAmp: 5.5,
  },
  {
    id: "liminal",
    cluster: "atmosphere",
    label: "Liminal spaces",
    x: 820,
    y: 630,
    r: 5,
    initialLabel: true,
    driftPhase: 3.3,
    driftSpeed: 0.16,
    driftAmp: 4.5,
  },
  {
    id: "cinema",
    cluster: "atmosphere",
    label: "Indie cinema",
    x: 970,
    y: 550,
    r: 4.5,
    driftPhase: 4.8,
    driftSpeed: 0.13,
    driftAmp: 4,
  },
  {
    id: "ideas",
    cluster: "atmosphere",
    label: "01:43 AM ideas",
    x: 870,
    y: 720,
    r: 5,
    ring: true,
    driftPhase: 2.4,
    driftSpeed: 0.18,
    driftAmp: 5,
  },
  {
    id: "slowtech",
    cluster: "atmosphere",
    label: "Slow tech",
    x: 1060,
    y: 670,
    r: 3.5,
    driftPhase: 5.9,
    driftSpeed: 0.15,
    driftAmp: 4.5,
  },
];

// Logical relationships connecting actual related interests
const links: [number, number, boolean?][] = [
  // Cluster 1 (Audio Archeology)
  [0, 1], // Analog synths ↔ Modular synthesis
  [1, 2], // Modular synthesis ↔ Tape loops
  [0, 3], // Analog synths ↔ Field recording

  // Cluster 2 (Computation & Cosmos)
  [4, 5], // Generative art ↔ Creative coding
  [5, 6], // Creative coding ↔ Stargazing
  [4, 7], // Generative art ↔ Solarpunk

  // Cluster 3 (Atmosphere & Cinema)
  [8, 9],   // Ambient music ↔ Liminal spaces
  [9, 10],  // Liminal spaces ↔ Indie cinema
  [9, 11],  // Liminal spaces ↔ 01:43 AM ideas
  [10, 12], // Indie cinema ↔ Slow tech

  // Subtle Inter-Cluster Bridges (dim by default, lights up when activated)
  [2, 8, true],  // Tape loops ↔ Ambient music (Audio bridge, true = bridge)
  [7, 12, true], // Solarpunk ↔ Slow tech (Philosophy bridge)
];

/** Living interest constellation: organic Béziers, slow breathing drift, proximity illumination */
export function HeroConstellation({ onCoord }: { onCoord?: (x: number, y: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const target = useRef({ x: -999, y: -999 });
  const cur = useRef({ x: -999, y: -999 });
  const [, tick] = useState(0);
  const t0 = useRef(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Parallax scroll: clusters reorganize into negative space on scroll
  const { scrollYProgress } = useScroll();
  const scrollOffsetCluster1 = useTransform(scrollYProgress, [0, 0.5], [0, -35]);
  const scrollOffsetCluster2 = useTransform(scrollYProgress, [0, 0.5], [0, 35]);
  const scrollOffsetCluster3 = useTransform(scrollYProgress, [0, 0.5], [0, 45]);
  const overallOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0.25]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !ref.current) return;
      const b = ref.current.getBoundingClientRect();
      const sx = ((e.clientX - b.left) / b.width) * 1200;
      const sy = ((e.clientY - b.top) / b.height) * 820;
      target.current = { x: sx, y: sy };
      onCoord?.(e.clientX / window.innerWidth, e.clientY / window.innerHeight);

      // Find nearest node for proximity activation
      let closest = -1;
      let minD = 130; // Restrained proximity threshold in SVG units
      nodes.forEach((n, idx) => {
        const d = Math.hypot(sx - n.x, sy - n.y);
        if (d < minD) {
          minD = d;
          closest = idx;
        }
      });
      setHoveredIdx(closest >= 0 ? closest : null);
    };

    const loop = (t: number) => {
      t0.current = t;
      const c = cur.current;
      const g = target.current;
      if (c.x < -900) {
        c.x = g.x;
        c.y = g.y;
      }
      c.x += (g.x - c.x) * 0.06;
      c.y += (g.y - c.y) * 0.06;
      tick((n) => (n + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", move);
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [onCoord]);

  // Set of connected nodes when any node is hovered/active
  const activeSet = useMemo(() => {
    if (hoveredIdx === null) return new Set<number>();
    const set = new Set<number>([hoveredIdx]);
    links.forEach(([a, b]) => {
      if (a === hoveredIdx) set.add(b);
      if (b === hoveredIdx) set.add(a);
    });
    return set;
  }, [hoveredIdx]);

  const t = t0.current / 1000;

  // Calculate dynamic node positions with slow cosmic drift and subtle cursor gravity
  const pos = nodes.map((n, i) => {
    const dx = cur.current.x - n.x;
    const dy = cur.current.y - n.y;
    const d = Math.hypot(dx, dy);
    // Subtle gravitational pull towards cursor (max 10px within 180px)
    const pull = d < 180 ? (1 - d / 180) * 10 : 0;
    // Slow, soothing cosmic drift
    const driftX = Math.sin(t * n.driftSpeed + n.driftPhase) * n.driftAmp;
    const driftY = Math.cos(t * n.driftSpeed * 0.85 + n.driftPhase * 1.3) * n.driftAmp;

    const isActive = activeSet.has(i);
    const isDirectHover = hoveredIdx === i;

    return {
      x: n.x + (d > 0 ? (dx / d) * pull : 0) + driftX,
      y: n.y + (d > 0 ? (dy / d) * pull : 0) + driftY,
      isActive,
      isDirectHover,
      cluster: n.cluster,
    };
  });

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 1200 820"
      className="h-full w-full overflow-visible"
      style={{ opacity: overallOpacity }}
      aria-hidden
    >
      {/* Dynamic connection lines: fine organic Béziers with subtle bow */}
      {links.map(([a, b, isBridge], i) => {
        const A = pos[a]!;
        const B = pos[b]!;

        // Calculate fine organic Bézier with subtle, graceful bow (not a giant semicircle)
        const mx = (A.x + B.x) / 2;
        const my = (A.y + B.y) / 2;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dist = Math.hypot(dx, dy);

        // Perpendicular unit vector
        const nx = dist > 0 ? -dy / dist : 0;
        const ny = dist > 0 ? dx / dist : 0;

        // Gentle curvature offset proportional to distance but capped at 12px
        const curveSign = (i % 2 === 0 ? 1 : -1) * (isBridge ? 0.6 : 1);
        const curveOffset = Math.sin(i * 1.8 + 0.4) * Math.min(dist * 0.05, 12) * curveSign;
        const cx = mx + nx * curveOffset;
        const cy = my + ny * curveOffset;

        const isLinkLit =
          hoveredIdx !== null &&
          (a === hoveredIdx || b === hoveredIdx || (activeSet.has(a) && activeSet.has(b)));

        return (
          <motion.path
            key={`link-${i}`}
            d={`M${A.x.toFixed(1)},${A.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${B.x.toFixed(1)},${B.y.toFixed(1)}`}
            fill="none"
            className={isLinkLit ? "stroke-signal" : "stroke-foreground"}
            strokeOpacity={
              isLinkLit
                ? 0.95
                : isBridge
                  ? 0.12 // Bridges stay very quiet across deep space
                  : 0.22 // Regular cluster connections are delicate
            }
            strokeWidth={isLinkLit ? 1.5 : isBridge ? 0.75 : 1}
            strokeDasharray={isBridge && !isLinkLit ? "3 5" : undefined}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.1 + i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}

      {/* Meaningful Nodes */}
      {nodes.map((n, i) => {
        const p = pos[i]!;
        // Label visibility: 4 anchor labels visible initially; others reveal on proximity/hover
        const showLabel = n.initialLabel || p.isActive;
        const isHighlight = p.isActive;

        return (
          <motion.g
            key={n.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0 + i * 0.05, type: "spring", stiffness: 240, damping: 20 }}
            style={{
              transformOrigin: `${n.x}px ${n.y}px`,
              x:
                n.cluster === "audio"
                  ? scrollOffsetCluster1
                  : n.cluster === "computation"
                    ? scrollOffsetCluster2
                    : scrollOffsetCluster3,
            }}
            className="pointer-events-auto cursor-pointer"
            onPointerEnter={() => setHoveredIdx(i)}
            onPointerLeave={() => setHoveredIdx(null)}
          >
            {/* Outer subtle orbital ring with restrained radius */}
            {n.ring && (
              <circle
                cx={p.x}
                cy={p.y}
                r={isHighlight ? n.r * 1.8 : n.r * 1.4}
                fill="none"
                className={isHighlight ? "stroke-signal" : "stroke-foreground"}
                strokeOpacity={isHighlight ? 0.75 : 0.25}
                strokeWidth={isHighlight ? 1 : 0.8}
                style={{ transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)" }}
              />
            )}

            {/* Core Node Circle */}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.isDirectHover ? n.r * 1.3 : isHighlight ? n.r * 1.15 : n.r}
              className={isHighlight ? "fill-signal" : "fill-foreground"}
              fillOpacity={isHighlight ? 1 : 0.85}
              style={{ transition: "all 240ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            />

            {/* Interest Label */}
            <text
              x={p.x + (n.cluster === "computation" && p.x > 950 ? -16 : 14)}
              y={p.y + 4}
              textAnchor={n.cluster === "computation" && p.x > 950 ? "end" : "start"}
              className={`font-mono text-[11px] uppercase tracking-[0.16em] select-none transition-all duration-300 ${
                isHighlight
                  ? "fill-signal font-semibold"
                  : n.initialLabel
                    ? "fill-muted-foreground/75"
                    : "fill-muted-foreground/0"
              }`}
              style={{
                opacity: showLabel ? (isHighlight ? 1 : 0.75) : 0,
                transform: `translateY(${showLabel ? 0 : 3}px)`,
                transition: "opacity 280ms ease, fill 280ms ease, transform 280ms ease",
              }}
            >
              {n.label}
            </text>
          </motion.g>
        );
      })}
    </motion.svg>
  );
}
