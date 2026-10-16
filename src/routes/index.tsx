import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDown, X, Check } from "lucide-react";
import { HeroConstellation } from "@/components/HeroConstellation";
import { InterestGraph } from "@/components/InterestGraph";
import { Footer } from "@/components/Footer";
import { communities, photos, starters } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cesium — Find your frequency" },
      {
        name: "description",
        content:
          "A social discovery space where people connect through obscure passions, niche hobbies and unexpected overlaps.",
      },
      { property: "og:title", content: "Cesium — Find your frequency" },
      {
        property: "og:description",
        content:
          "Different atoms. Unexpected bonds. Meet the people who get your strangely specific world.",
      },
    ],
  }),
  component: Home,
});

const ease = [0.16, 1, 0.3, 1] as const;

function Home() {
  return (
    <>
      <Hero />
      <SectionA />
      <SectionB />
      <SectionC />
      <SectionD />
      <SectionE />
      <SectionF />
      <SectionG />
      <SectionH />
      <Footer />
    </>
  );
}

function Hero() {
  const [c, setC] = useState({ x: 0.5, y: 0.5 });
  const onCoord = useCallback((x: number, y: number) => setC({ x, y }), []);
  const delay = 1.15;
  return (
    <section className="gutter relative flex min-h-[100svh] flex-col justify-between overflow-hidden pb-4 pt-16 md:pb-6 md:pt-20">
      <div className="pointer-events-none absolute inset-0 h-full w-full opacity-75 md:opacity-95">
        <HeroConstellation onCoord={onCoord} />
      </div>
      <motion.div
        className="absolute left-0 top-1/2 h-px bg-signal"
        initial={{ width: "100%", opacity: 0.8 }}
        animate={{ width: "0%", opacity: 0 }}
        transition={{ delay: 0.9, duration: 0.8, ease }}
      />

      {/* Upward-placed CESIUM Title with purposeful atomic frequency beacon on the 'i' */}
      <div className="relative pt-4 md:pt-8">
        <h1
          className="display -ml-[0.04em] flex overflow-hidden text-[clamp(84px,19vw,260px)]"
          aria-label="Cesium"
        >
          {"Cesium".split("").map((l, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="relative inline-block"
              initial={{ y: "105%" }}
              animate={{ y: 0 }}
              transition={{ delay: delay + i * 0.07, duration: 0.9, ease }}
            >
              {l === "i" ? (
                <span className="relative inline-block">
                  {"\u0131"}
                  {/* Purposeful atomic frequency beacon on the 'i' - bound to text dimension (em), moved 4% up and 5% right */}
                  <motion.span
                    className="pointer-events-none absolute left-[60%] top-[20%] -translate-x-1/2 -translate-y-1/2"
                    aria-hidden
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: delay + 1.45,
                      duration: 0.6,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <motion.span
                      className="block h-[0.11em] w-[0.11em] rounded-[0.02em] bg-signal shadow-[0_0_0.05em_oklch(0.92_0.22_128/0.6)]"
                      animate={{
                        scale: [0.96, 1.04, 0.96],
                        opacity: [0.9, 1, 0.9],
                      }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: delay + 1.45,
                      }}
                    />
                    <motion.span
                      className="absolute inset-0 -m-[0.012em] rounded-[0.025em] border-[0.008em] border-signal/60"
                      animate={{
                        scale: [1, 1.35],
                        opacity: [0.75, 0],
                      }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: delay + 1.45,
                      }}
                    />
                  </motion.span>
                </span>
              ) : (
                l
              )}
            </motion.span>
          ))}
        </h1>
      </div>

      {/* Lowered-down Find your frequency & FREQ block */}
      <div className="relative mt-auto pb-2 md:pb-4">
        <div className="grid grid-cols-12 gap-4">
          <motion.div
            className="col-span-12 md:col-span-8 md:col-start-1"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + 0.55, duration: 0.6, ease }}
          >
            <p className="font-display text-2xl font-semibold text-signal md:text-3xl">
              Find your frequency.
            </p>
            <p className="mt-2 max-w-md text-base text-muted-foreground md:text-lg">
              People are more than profiles. Find the ones who get your strangely specific world.
            </p>
          </motion.div>
        </div>
        <motion.div
          className="mt-6 flex items-center justify-between md:mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 1 }}
        >
          <a
            href="#how"
            className="label-mono flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            Scroll to discover <ArrowDown size={12} />
          </a>
          <p className="label-mono hidden text-muted-foreground md:block" aria-hidden>
            FREQ {(400 + c.x * 380).toFixed(1)} Hz · Φ {(c.y * 360).toFixed(0).padStart(3, "0")}°
          </p>
        </motion.div>
      </div>
    </section>
  );
}

const fragments = [
  "Bird calls",
  "Lisp",
  "Bauhaus chairs",
  "Moss",
  "Tarkovsky",
  "Knots",
  "Tide tables",
  "Chiptune",
];

function SectionA() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const lines = ["Somewhere,", "someone", "gets it."];
  return (
    <section
      id="how"
      ref={ref}
      className="paper-section gutter relative overflow-hidden py-32 md:py-48"
    >
      <p className="label-mono text-ink-muted">001 — Your people are out there</p>
      <div className="relative mt-14">
        {lines.map((l, i) => (
          <MaskLine key={i} p={scrollYProgress} i={i} text={l} />
        ))}
        {fragments.map((f, i) => (
          <Fragment key={f} p={scrollYProgress} i={i} text={f} />
        ))}
      </div>
      <div className="mt-20 grid grid-cols-12 gap-6">
        <p className="col-span-12 text-xl leading-relaxed md:col-span-5 md:col-start-8">
          No follower counts. No feeds to perform for. Cesium maps what you actually care about,
          then quietly finds the people orbiting the same strange things.
        </p>
      </div>
    </section>
  );
}

function MaskLine({ p, i, text }: { p: MotionValue<number>; i: number; text: string }) {
  const clip = useTransform(
    p,
    [0.1 + i * 0.08, 0.35 + i * 0.08],
    ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  );
  const offsets = ["md:ml-0", "md:ml-[22vw]", "md:ml-[8vw]"];
  return (
    <div className={`relative ${offsets[i]}`}>
      <span className="display block pb-[0.14em] text-[clamp(56px,11vw,168px)] opacity-10">
        {text}
      </span>
      <motion.span
        style={{ clipPath: clip }}
        className="display absolute inset-0 block pb-[0.14em] text-[clamp(56px,11vw,168px)]"
      >
        {text}
      </motion.span>
    </div>
  );
}

function Fragment({ p, i, text }: { p: MotionValue<number>; i: number; text: string }) {
  const sx = (i % 2 ? 1 : -1) * (30 + i * 4);
  const x = useTransform(p, [0, 0.7], [`${sx}vw`, `${sx * 0.15}vw`]);
  const top = 8 + ((i * 37) % 80);
  const left = 40 + ((i * 23) % 30);
  return (
    <motion.span
      style={{ x, top: `${top}%`, left: `${left}%` }}
      className="label-mono pointer-events-none absolute hidden border border-ink/20 px-2 py-1 text-ink-muted md:inline-block"
    >
      {i < 2 && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ink" />}
      {text}
    </motion.span>
  );
}

function SectionB() {
  return (
    <section className="gutter relative py-32">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <p className="label-mono text-muted-foreground">002 — Interest constellation</p>
          <h2 className="display mt-6 text-[clamp(44px,6.5vw,104px)]">
            Your mind, <span className="text-outline">mapped.</span>
          </h2>
          <p className="mt-6 max-w-sm text-muted-foreground">
            Every interest is a node. Every person who shares two of them is a possible
            conversation. Hover, select, compare.
          </p>
        </div>
        <div className="col-span-12 md:col-span-8">
          <InterestGraph />
        </div>
      </div>
    </section>
  );
}

const miraI = ["Film photography", "Creative coding", "Astronomy", "Ambient music"];
const eliI = ["Indie games", "Creative coding", "Astronomy", "Synthesizers"];

function SectionC() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  const Cluster = ({
    name,
    list,
    side,
    photo,
  }: {
    name: string;
    list: string[];
    side: 1 | -1;
    photo: string;
  }) => (
    <motion.div
      initial={{ x: side * -120, opacity: 0 }}
      whileInView={{ x: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.9, ease }}
      className={`flex flex-col gap-3 ${side === 1 ? "items-start" : "items-end text-right"}`}
    >
      <div className="flex items-center gap-3">
        <img
          src={photo}
          alt={`${name}, a sample profile`}
          loading="lazy"
          width={768}
          height={960}
          className="h-14 w-14 object-cover grayscale"
        />
        <p className="font-display text-3xl font-bold">{name}</p>
      </div>
      {list.map((x) => {
        const s = miraI.includes(x) && eliI.includes(x);
        return (
          <span key={x} className={`chip ${s ? "chip-shared" : "text-muted-foreground"}`}>
            {s && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
            {x}
          </span>
        );
      })}
    </motion.div>
  );
  return (
    <section className="gutter relative border-t border-border bg-surface/30 py-32">
      <p className="label-mono text-muted-foreground">003 — The overlap engine</p>
      <h2 className="display mt-6 max-w-5xl text-[clamp(40px,6vw,96px)]">
        Similarity is a little more interesting than a number.
      </h2>
      <div className="mt-20 grid items-center gap-10 md:grid-cols-[1fr_auto_1fr]">
        <Cluster name="Mira" list={miraI} side={1} photo={photos.mira} />
        <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8, ease }}
            className="absolute inset-0 rounded-full border border-signal/50"
          />
          <div className="absolute inset-6 rounded-full border border-dashed border-border" />
          <div className="text-center">
            <p className="label-mono text-signal">Overlap</p>
            <p className="font-display text-xl font-semibold">2 bonds</p>
          </div>
        </div>
        <Cluster name="Eli" list={eliI} side={-1} photo={photos.eli} />
      </div>
      <div className="mx-auto mt-16 max-w-2xl text-center">
        <p className="text-xl leading-relaxed">
          “You both build things for fun, lose track of time thinking about space, and like turning
          strange ideas into real projects.”
        </p>
        <button onClick={() => setOpen(true)} className="btn-ghost mt-8">
          See connection <ArrowUpRight size={16} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Connection details"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.45, ease }}
              className="w-full max-w-xl border border-border bg-background p-8"
            >
              <div className="flex items-start justify-between">
                <p className="label-mono text-signal">Mira × Eli — Connection report</p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  autoFocus
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <ol className="mt-6 space-y-5">
                {[
                  [
                    "Shared",
                    "Creative coding, Astronomy",
                    "Direct overlap — the easiest place to start.",
                  ],
                  [
                    "Adjacent",
                    "Ambient music ↔ Synthesizers",
                    "One listens, one builds. Great for 'show me your setup' conversations.",
                  ],
                  [
                    "Uncommon",
                    "Film photography ↔ Indie games",
                    "Both care about atmosphere over polish.",
                  ],
                ].map(([k, t, d], i) => (
                  <li key={k} className="grid grid-cols-[auto_1fr] gap-4">
                    <span className="label-mono pt-1 text-muted-foreground">0{i + 1}</span>
                    <div>
                      <p className="label-mono text-muted-foreground">{k}</p>
                      <p className="font-display text-lg font-semibold">{t}</p>
                      <p className="text-sm text-muted-foreground">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="label-mono mt-8 text-muted-foreground">Sample profiles · demo data</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SectionD() {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <section className="gutter relative py-32">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <p className="label-mono text-muted-foreground">004 — Break the ice</p>
          <h2 className="display mt-6 text-[clamp(40px,5.5vw,88px)]">
            The first message shouldn't be the hardest part.
          </h2>
          <div className="mt-12 space-y-3">
            {starters.map((s, i) => (
              <motion.button
                key={s}
                onClick={() => setPicked(i)}
                whileHover={{ x: 6, rotate: i % 2 ? 0.4 : -0.4 }}
                whileTap={{ scale: 0.98 }}
                className={`flex w-full items-start gap-4 border p-5 text-left transition-colors ${picked === i ? "border-signal" : "border-border hover:border-foreground/40"}`}
              >
                <span className="label-mono pt-1 text-muted-foreground">Q{i + 1}</span>
                {picked === i ? (
                  <span className="text-lg text-muted-foreground line-through decoration-signal/50">
                    {s}
                  </span>
                ) : (
                  <motion.span layoutId={`q-${i}`} className="text-lg">
                    {s}
                  </motion.span>
                )}
              </motion.button>
            ))}
          </div>
        </div>
        <div className="col-span-12 md:col-span-5 md:col-start-8 md:pt-24">
          <div className="border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <img
                src={photos.kai}
                alt="Kai, sample profile"
                loading="lazy"
                width={768}
                height={960}
                className="h-9 w-9 object-cover"
              />
              <div>
                <p className="text-sm font-medium">Kai Nakamura</p>
                <p className="label-mono text-muted-foreground">Shares: Indie cinema · Ambient</p>
              </div>
            </div>
            <div className="space-y-2 p-4">
              <p className="max-w-[80%] border-l border-signal pl-3 text-sm text-muted-foreground">
                You both saved the same Wong Kar-wai still. Say hi?
              </p>
            </div>
            <div className="border-t border-border p-4">
              <p className="label-mono mb-2 text-muted-foreground">Composer</p>
              <div className="min-h-[72px] text-lg">
                {picked !== null ? (
                  <motion.span
                    layoutId={`q-${picked}`}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  >
                    {starters[picked]}
                  </motion.span>
                ) : (
                  <span className="text-muted-foreground">Pick a starter…</span>
                )}
                <span className="caret ml-0.5 inline-block h-5 w-px translate-y-1 bg-signal" />
              </div>
              <AnimatePresence>
                {picked !== null && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="label-mono mt-3 flex items-center gap-2 text-signal"
                  >
                    <Check size={12} /> Starter ready to send
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionE() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const lx = useTransform(scrollYProgress, [0, 1], ["-18vw", "0vw"]);
  const rx = useTransform(scrollYProgress, [0, 1], ["18vw", "0vw"]);
  const bend = useTransform(scrollYProgress, [0, 1], [180, 20]);
  const d = useTransform(bend, (b) => `M0,100 C300,${100 + b} 700,${100 - b} 1000,100`);
  return (
    <section ref={ref} className="gutter relative overflow-hidden border-y border-border py-32">
      <p className="label-mono text-center text-muted-foreground">005 — Uncommon ground</p>
      <h2 className="display mx-auto mt-6 max-w-4xl text-center text-[clamp(40px,6vw,96px)]">
        Not the same. Still connected.
      </h2>
      <div className="relative mt-20 grid grid-cols-2 gap-8">
        <motion.ul
          style={{ x: lx }}
          className="space-y-2 font-display text-[clamp(22px,3vw,44px)] font-semibold"
        >
          <li>Vinyl only.</li>
          <li className="text-muted-foreground">Cities at night.</li>
          <li>Hard sci-fi.</li>
          <li className="text-muted-foreground">Plan everything.</li>
        </motion.ul>
        <motion.ul
          style={{ x: rx }}
          className="space-y-2 text-right font-display text-[clamp(22px,3vw,44px)] font-semibold"
        >
          <li className="text-muted-foreground">Streams everything.</li>
          <li>Mountains at dawn.</li>
          <li className="text-muted-foreground">Magical realism.</li>
          <li>Follow the detour.</li>
        </motion.ul>
        <svg
          viewBox="0 0 1000 200"
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
          preserveAspectRatio="none"
          aria-hidden
        >
          <motion.path
            d={d}
            fill="none"
            className="stroke-signal"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <p className="mx-auto mt-16 max-w-xl text-center text-muted-foreground">
        Two people who disagree about how to listen to music will talk about music for three hours.
        Cesium surfaces friction that's worth having.
      </p>
    </section>
  );
}

function SectionF() {
  const layout = [
    "md:col-span-7 md:row-span-2",
    "md:col-span-5",
    "md:col-span-5 md:translate-y-10",
    "md:col-span-6 md:col-start-4",
  ];
  return (
    <section className="gutter py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label-mono text-muted-foreground">006 — Micro-communities</p>
          <h2 className="display mt-6 max-w-3xl text-[clamp(40px,5.5vw,88px)]">
            Somewhere between niche and necessary.
          </h2>
        </div>
        <Link to="/communities" className="btn-ghost">
          All communities <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="mt-16 grid gap-4 md:grid-cols-12">
        {communities.slice(0, 4).map((c, i) => (
          <Link
            key={c.id}
            to="/communities/$id"
            params={{ id: c.id }}
            className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden border border-border p-6 transition-transform duration-300 hover:-translate-y-1 hover:translate-x-1 ${layout[i]}`}
          >
            {i === 0 && (
              <img
                src={photos.moment}
                alt=""
                loading="lazy"
                width={1280}
                height={832}
                className="absolute inset-0 h-full w-full object-cover opacity-35 transition-opacity duration-500 group-hover:opacity-55"
              />
            )}
            {i === 0 && (
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            )}
            {i === 2 && (
              <svg
                className="absolute right-4 top-4 h-28 w-28 text-muted-foreground"
                viewBox="0 0 100 100"
                aria-hidden
              >
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="2 4"
                />
                <circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" />
                <circle cx="90" cy="50" r="3" className="fill-signal" />
              </svg>
            )}
            <div className="relative flex items-start justify-between">
              <span className="label-mono text-muted-foreground">
                {String(i + 1).padStart(3, "0")}
              </span>
              <ArrowUpRight
                className="translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 text-signal"
                size={20}
              />
            </div>
            <div className="relative">
              <p className={`display ${i === 0 ? "text-[clamp(40px,5vw,80px)]" : "text-4xl"}`}>
                {c.name}
              </p>
              <p className="mt-2 text-muted-foreground">{c.line}</p>
              <p className="label-mono mt-4 text-muted-foreground transition-colors group-hover:text-signal">
                {c.members} members · {c.topics.slice(0, 2).join(" / ")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionG() {
  return (
    <section className="gutter py-40">
      <div className="grid grid-cols-12 items-end gap-6">
        <figure className="col-span-12 md:col-span-4">
          <img
            src={photos.ines}
            alt="Inês looking through a telescope on a rooftop"
            loading="lazy"
            width={768}
            height={960}
            className="aspect-[4/5] w-full object-cover"
          />
          <figcaption className="label-mono mt-3 text-muted-foreground">
            Inês, Lisbon — Orbit Club
          </figcaption>
        </figure>
        <div className="col-span-12 md:col-span-4 md:pb-24">
          <p className="font-display text-[clamp(28px,3vw,44px)] font-semibold leading-tight">
            Curiosity is a better introduction than a job title.
          </p>
          <p className="mt-6 text-muted-foreground">
            Cesium is software, but it's about the rooftop, the workbench, the record shop at
            closing time — and the person beside you who finally understands.
          </p>
        </div>
        <figure className="col-span-12 md:col-span-4 md:-translate-y-24">
          <img
            src={photos.kai}
            alt="Kai reading in a record shop"
            loading="lazy"
            width={768}
            height={960}
            className="aspect-[3/4] w-full object-cover grayscale"
          />
          <figcaption className="label-mono mt-3 text-muted-foreground">
            Kai, Osaka — Frame by Frame
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function SectionH() {
  const [hot, setHot] = useState(false);
  const pts = [
    [120, 80],
    [880, 60],
    [200, 320],
    [820, 300],
    [500, 30],
    [500, 360],
  ];
  return (
    <section className="gutter relative overflow-hidden py-40 text-center">
      <svg
        viewBox="0 0 1000 400"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        {pts.map(([x, y], i) => (
          <g key={i}>
            <motion.line
              x1={x}
              y1={y}
              x2={500}
              y2={200}
              vectorEffect="non-scaling-stroke"
              className={hot ? "stroke-signal" : "stroke-border"}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.1, duration: 1.2, ease }}
            />
            <motion.circle
              cx={x}
              cy={y}
              r={3}
              className={hot ? "fill-signal" : "fill-muted-foreground"}
            />
          </g>
        ))}
      </svg>
      <div className="relative">
        <p className="label-mono text-muted-foreground">007 — Your turn</p>
        <h2 className="display mx-auto mt-8 max-w-5xl text-[clamp(52px,9vw,150px)]">
          Find your kind of weird.
        </h2>
        <Link
          to="/onboarding"
          onMouseEnter={() => setHot(true)}
          onMouseLeave={() => setHot(false)}
          className="btn-signal mt-12"
        >
          <span>Enter Cesium</span>
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}
