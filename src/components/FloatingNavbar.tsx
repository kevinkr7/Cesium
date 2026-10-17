import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Compass, Home, Sparkles, Users, MessageSquare, LogOut, ArrowUpRight } from "lucide-react";
import { Mark } from "./Mark";
import { setDemo, useDemo } from "@/lib/store";
import { signOutUser } from "@/services/auth";

const items = [
  { to: "/", label: "Home", icon: Home, num: "01" },
  { to: "/discover", label: "Discover", icon: Compass, num: "02" },
  { to: "/constellation", label: "Constellation", icon: Sparkles, num: "03" },
  { to: "/communities", label: "Communities", icon: Users, num: "04" },
] as const;

export function FloatingNavbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useDemo();
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  const handleSignOut = async () => {
    await signOutUser();
    setDemo({ session: null });
  };

  // Only show Discover, Constellation, and Communities if the user is logged in
  const visibleItems = session ? items : items.filter((i) => i.to === "/");
  const active = visibleItems.find((i) =>
    i.to === "/" ? path === "/" : path.startsWith(i.to),
  )?.to;
  const indicator = hover ?? active;

  return (
    <>
      {/* Desktop Floating Sleek & Long Vertical Navbar on the Left */}
      <motion.nav
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto fixed bottom-4 left-4 top-4 z-50 hidden w-48 select-none flex-col justify-between rounded-2xl border border-border bg-background/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-md md:flex"
        aria-label="Primary"
      >
        {/* Top: Brand & Navigation */}
        <div className="flex flex-col gap-4">
          <Link
            to="/"
            aria-label="Cesium home"
            className="group flex items-center gap-3 px-1 py-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
          >
            <Mark />
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-signal">
                Cesium
              </span>
              <span className="label-mono text-[8px] text-muted-foreground">CS // 055</span>
            </div>
          </Link>

          <div className="h-px w-full bg-border/60" />

          {/* Navigation Links */}
          <div className="space-y-1">
            <p className="label-mono mb-2 px-2 text-[9px] tracking-wider text-muted-foreground/60">
              EXPLORE
            </p>
            <ul className="space-y-1.5" onMouseLeave={() => setHover(null)}>
              {visibleItems.map((i) => {
                const Icon = i.icon;
                const isItemActive = active === i.to;
                return (
                  <li key={i.to} className="relative">
                    <Link
                      to={i.to}
                      onMouseEnter={() => setHover(i.to)}
                      className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
                        isItemActive
                          ? "bg-surface/80 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-surface/40 hover:text-foreground"
                      }`}
                    >
                      {indicator === i.to && (
                        <motion.span
                          layoutId="floating-nav-ind"
                          className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-signal"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                      <div className="flex items-center gap-2.5">
                        <Icon
                          size={15}
                          className={`transition-colors ${
                            isItemActive
                              ? "text-signal"
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                        <span>{i.label}</span>
                      </div>
                      {isItemActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_rgba(185,255,56,0.6)]" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Bottom Actions & Status Section */}
        <div className="flex flex-col gap-3">
          {session ? (
            <>
              <Link
                to="/messages"
                search={{ c: undefined }}
                onMouseEnter={() => setHover("/messages")}
                className={`group relative flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all ${
                  path.startsWith("/messages")
                    ? "border-signal/50 bg-signal/10 font-medium text-foreground"
                    : "border-border/60 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {indicator === "/messages" && (
                  <motion.span
                    layoutId="floating-nav-ind"
                    className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-signal"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <MessageSquare
                    size={14}
                    className={
                      path.startsWith("/messages")
                        ? "text-signal"
                        : "text-muted-foreground group-hover:text-signal"
                    }
                  />
                  <span>Messages</span>
                </div>
                <span className="label-mono text-[9px] font-semibold text-signal">ACTIVE</span>
              </Link>

              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <div className="flex min-w-0 items-center gap-2 pr-1">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-[10px] font-semibold text-signal">
                    {session.name ? session.name.slice(0, 2).toUpperCase() : "CS"}
                  </div>
                  <span className="truncate text-xs font-medium text-foreground">
                    {session.name.split(" ")[0]}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-destructive"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Link
                to="/login"
                className="btn-signal flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold tracking-wider"
              >
                <span>Sign in</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          )}

          <div className="label-mono flex items-center justify-between border-t border-border/40 pt-2.5 text-[8px] text-muted-foreground/70">
            <span>FREQ 055.00</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
              ONLINE
            </span>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Top Navigation Header */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur-md md:hidden">
        <Link to="/" aria-label="Cesium home">
          <Mark />
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 flex-col items-center justify-center gap-1.5"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <span className="h-px w-5 bg-foreground" />
          <span className="ml-2 h-px w-3 bg-signal" />
        </button>
      </header>
      <MobileMenu
        open={open}
        onClose={() => setOpen(false)}
        signedIn={!!session}
        onSignOut={handleSignOut}
      />
    </>
  );
}

function MobileMenu({
  open,
  onClose,
  signedIn,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  onSignOut: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("a,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("a,button");
        const first = f[0]!,
          lastEl = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);

  const links = signedIn
    ? [...items, { to: "/messages", label: "Messages" }]
    : [
        { to: "/", label: "Home" },
        { to: "/login", label: "Sign in" },
      ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="gutter fixed inset-0 z-[60] flex flex-col bg-background pt-8"
          initial={{ clipPath: "circle(0% at 90% 6%)" }}
          animate={{ clipPath: "circle(150% at 90% 6%)" }}
          exit={{ clipPath: "circle(0% at 90% 6%)" }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="flex items-center justify-between">
            <Mark />
            <button
              onClick={onClose}
              className="label-mono h-11 px-2 text-muted-foreground"
              aria-label="Close menu"
            >
              Close ×
            </button>
          </div>
          <ul className="mt-16 space-y-4">
            {links.map((l, i) => (
              <li key={l.to} className="overflow-hidden">
                <motion.div
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link to={l.to} onClick={onClose} className="group flex items-baseline gap-4">
                    <span className="label-mono text-signal">0{i + 1}</span>
                    <span className="display text-[13vw] leading-none group-hover:text-signal">
                      {l.label}
                    </span>
                  </Link>
                </motion.div>
              </li>
            ))}
            {signedIn && (
              <li className="overflow-hidden pt-4">
                <button
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  className="label-mono text-sm text-destructive hover:underline"
                >
                  Sign out
                </button>
              </li>
            )}
          </ul>
          <p className="label-mono mt-auto pb-8 text-muted-foreground">
            CS / 055 — Find your frequency
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
