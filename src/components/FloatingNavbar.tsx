import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Compass,
  Home,
  Sparkles,
  Users,
  MessageSquare,
  LogOut,
  ArrowUpRight,
  Bell,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Mark } from "./Mark";
import { setDemo, useDemo } from "@/lib/store";
import { signOutUser } from "@/services/auth";
import {
  fetchNotifications,
  subscribeToRealtimeNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/services/notifications";
import {
  fetchPendingRequests,
  respondToConnectionRequest,
  type PendingConnectionRequest,
} from "@/services/connections";

const items = [
  { to: "/", label: "Home", icon: Home, num: "01" },
  { to: "/discover", label: "Discover", icon: Compass, num: "02" },
  { to: "/constellation", label: "Constellation", icon: Sparkles, num: "03" },
  { to: "/communities", label: "Communities", icon: Users, num: "04" },
] as const;

function formatTimeAgo(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}

export function FloatingNavbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { session, profile } = useDemo();
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionRequest[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
    setShowNotifs(false);
  }, [path]);

  const loadAlerts = useCallback(async () => {
    if (!session?.id || session.id === "demo") return;
    try {
      const [notifs, pending] = await Promise.all([
        fetchNotifications(session.id),
        fetchPendingRequests(session.id),
      ]);
      setNotifications(notifs);
      setPendingRequests(pending.incoming);
      const unreadCount = notifs.filter((n) => !n.isRead).length + pending.incoming.length;
      setDemo({ unreadNotificationCount: unreadCount });
    } catch {
      // Ignore background refresh errors
    }
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id || session.id === "demo") return;
    loadAlerts();

    const unsub = subscribeToRealtimeNotifications(
      session.id,
      (newNotif) => {
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
        toast(`Alert: ${newNotif.title}`, {
          description:
            newNotif.type === "connection_request" ? "New connection request received" : undefined,
        });
        loadAlerts();
      },
      () => {
        loadAlerts();
      },
    );

    const interval = setInterval(loadAlerts, 8000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [session?.id, loadAlerts]);

  useEffect(() => {
    if (!showNotifs) return;
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotifs(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotifs]);

  const handleSignOut = async () => {
    await signOutUser();
    setDemo({ session: null });
  };

  const handleAccept = async (req: PendingConnectionRequest) => {
    const res = await respondToConnectionRequest(req.id, "accepted", session?.id);
    if (res.success) {
      toast.success(`Connected with ${req.userName.split(" ")[0]}!`, {
        description: "You can now message each other on Cesium.",
      });
      setDemo((s) => ({
        connections: { ...s.connections, [req.userId]: "connected" },
      }));
      await loadAlerts();
    } else {
      toast.error("Failed to accept connection", { description: res.error ?? undefined });
    }
  };

  const handleDecline = async (req: PendingConnectionRequest) => {
    await respondToConnectionRequest(req.id, "declined", session?.id);
    toast.info(`Declined connection from ${req.userName.split(" ")[0]}`);
    setDemo((s) => {
      const next = { ...s.connections };
      delete next[req.userId];
      return { connections: next };
    });
    await loadAlerts();
  };

  const handleMarkAllRead = async () => {
    if (session?.id) {
      await markAllNotificationsRead(session.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setDemo({ unreadNotificationCount: pendingRequests.length });
    }
  };

  const handleReadNotification = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  // Only show Discover, Constellation, and Communities if the user is logged in
  const visibleItems = session ? items : items.filter((i) => i.to === "/");
  const active = visibleItems.find((i) =>
    i.to === "/" ? path === "/" : path.startsWith(i.to),
  )?.to;
  const indicator = hover ?? active;
  const displayName = profile?.display_name || session?.name || "Explorer";
  const unreadCount = notifications.filter((n) => !n.isRead).length + pendingRequests.length;

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
              {/* Notifications Trigger Button Placed Above Messages */}
              <div className="relative">
                <button
                  type="button"
                  id="nav-notifications-btn"
                  onClick={() => setShowNotifs((v) => !v)}
                  onMouseEnter={() => setHover("notifications")}
                  className={`group relative flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all ${
                    showNotifs
                      ? "border-signal/50 bg-signal/10 font-medium text-foreground"
                      : "border-border/60 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                  aria-label="Notifications"
                  aria-expanded={showNotifs}
                >
                  {indicator === "notifications" && (
                    <motion.span
                      layoutId="floating-nav-ind"
                      className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-signal"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center">
                      <Bell
                        size={14}
                        className={
                          showNotifs || unreadCount > 0
                            ? "text-signal"
                            : "text-muted-foreground group-hover:text-signal"
                        }
                      />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-signal shadow-[0_0_8px_rgba(185,255,56,0.9)] animate-pulse" />
                      )}
                    </div>
                    <span>Alerts</span>
                  </div>

                  {unreadCount > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
                      <span className="label-mono text-[9px] font-semibold text-signal">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    </span>
                  ) : (
                    <span className="label-mono text-[9px] text-muted-foreground/60">0</span>
                  )}
                </button>
              </div>

              {/* Messages Link */}
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
                <Link
                  to="/constellation"
                  className="flex min-w-0 items-center gap-2 pr-1 transition-opacity hover:opacity-80"
                  title="View your constellation profile"
                >
                  {profile?.avatar_path ? (
                    <img
                      src={profile.avatar_path}
                      alt={displayName}
                      className="h-7 w-7 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-[10px] font-semibold text-signal">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate text-xs font-medium text-foreground">
                    {displayName.split(" ")[0]}
                  </span>
                </Link>
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

      {/* Interactive Notification Popover Drawer (Desktop & Mobile) */}
      <AnimatePresence>
        {showNotifs && session && (
          <motion.div
            ref={notifRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 top-20 z-[70] flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-background/95 p-4 shadow-2xl shadow-black/80 backdrop-blur-xl md:left-56 md:right-auto md:top-auto md:bottom-4 md:w-96"
            aria-label="Notification center"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-signal" />
                <span className="font-display text-sm font-semibold text-foreground">
                  Signals & Alerts
                </span>
                {unreadCount > 0 && (
                  <span className="label-mono rounded bg-signal/15 px-1.5 py-0.5 text-[9px] font-bold text-signal">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.some((n) => !n.isRead) && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="label-mono text-[9px] text-muted-foreground transition-colors hover:text-signal"
                  >
                    Mark read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotifs(false)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                  aria-label="Close alerts"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable Alerts Body */}
            <div className="flex-1 space-y-4 overflow-y-auto pr-1 pt-3">
              {/* Incoming Connection Requests */}
              {pendingRequests.length > 0 && (
                <div className="space-y-2">
                  <span className="label-mono text-[9px] font-semibold text-signal">
                    PENDING REQUESTS ({pendingRequests.length})
                  </span>
                  <div className="space-y-2">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/50 p-3 transition-colors hover:border-signal/40"
                      >
                        <div className="flex items-center gap-2.5">
                          {req.userAvatar ? (
                            <img
                              src={req.userAvatar}
                              alt={req.userName}
                              className="h-8 w-8 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-[11px] font-semibold text-signal">
                              {req.userName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {req.userName}
                            </span>
                            <span className="truncate text-[10px] text-muted-foreground">
                              @{req.userHandle} · {req.userCity}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Wants to connect with your orbit on Cesium.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAccept(req)}
                            className="btn-signal flex-1 justify-center py-1 text-[11px] font-semibold"
                          >
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecline(req)}
                            className="btn-ghost flex-1 justify-center py-1 text-[11px] text-muted-foreground hover:text-destructive"
                          >
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Realtime Notifications List */}
              <div className="space-y-2">
                {notifications.length > 0 && (
                  <span className="label-mono text-[9px] text-muted-foreground/80">
                    ACTIVITY TIMELINE
                  </span>
                )}
                {notifications.length === 0 && pendingRequests.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs font-medium text-foreground">Your frequency is clear</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      No pending connection requests or alerts right now.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleReadNotification(n.id)}
                        className={`group relative flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                          n.isRead
                            ? "border-border/40 bg-surface/20 text-muted-foreground hover:bg-surface/40"
                            : "border-signal/30 bg-surface/60 text-foreground"
                        }`}
                      >
                        {!n.isRead && (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_6px_rgba(185,255,56,0.8)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-medium text-foreground">
                              {n.title}
                            </p>
                            <span className="label-mono shrink-0 text-[8px] text-muted-foreground/60">
                              {formatTimeAgo(n.createdAt)}
                            </span>
                          </div>
                          {n.type === "connection_accepted" && n.sender && (
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                Connected with @{n.sender.handle}
                              </span>
                              <Link
                                to="/messages"
                                search={{ c: n.sender.id }}
                                onClick={() => setShowNotifs(false)}
                                className="flex items-center gap-1 text-[10px] font-semibold text-signal hover:underline"
                              >
                                <span>Message</span>
                                <ArrowUpRight size={10} />
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Top Navigation Header */}
      <header
        data-hydrated={mounted ? "true" : undefined}
        className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur-md md:hidden"
      >
        <Link to="/" aria-label="Cesium home">
          <Mark />
        </Link>
        <div className="flex items-center gap-2">
          {session && (
            <button
              type="button"
              id="mobile-notifs-btn"
              onClick={() => setShowNotifs((v) => !v)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface/40 text-foreground transition-colors hover:border-signal/50"
              aria-label="Open notifications"
            >
              <Bell
                size={18}
                className={unreadCount > 0 ? "text-signal" : "text-muted-foreground"}
              />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-signal shadow-[0_0_8px_rgba(185,255,56,0.9)] animate-pulse" />
              )}
            </button>
          )}
          <button
            type="button"
            id="mobile-open-menu-btn"
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <span className="h-px w-5 bg-foreground" />
            <span className="ml-2 h-px w-3 bg-signal" />
          </button>
        </div>
      </header>
      <MobileMenu
        open={open}
        onClose={() => setOpen(false)}
        signedIn={!!session}
        onSignOut={handleSignOut}
        unreadCount={unreadCount}
        onOpenNotifs={() => setShowNotifs(true)}
      />
    </>
  );
}

function MobileMenu({
  open,
  onClose,
  signedIn,
  onSignOut,
  unreadCount,
  onOpenNotifs,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  onSignOut: () => void;
  unreadCount: number;
  onOpenNotifs: () => void;
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

  type MobileNavLink = {
    to: string;
    label: string;
    isAlerts?: boolean;
  };

  const links: MobileNavLink[] = signedIn
    ? [
        ...items.map((i) => ({ to: i.to, label: i.label })),
        { to: "#alerts", label: "Alerts", isAlerts: true },
        { to: "/messages", label: "Messages" },
      ]
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
                  {l.isAlerts ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenNotifs();
                      }}
                      className="group flex w-full items-baseline justify-between text-left"
                    >
                      <div className="flex items-baseline gap-4">
                        <span className="label-mono text-signal">0{i + 1}</span>
                        <span className="display text-[13vw] leading-none group-hover:text-signal">
                          {l.label}
                        </span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="h-3 w-3 rounded-full bg-signal shadow-[0_0_8px_rgba(185,255,56,0.9)] animate-pulse" />
                      )}
                    </button>
                  ) : (
                    <Link to={l.to} onClick={onClose} className="group flex items-baseline gap-4">
                      <span className="label-mono text-signal">0{i + 1}</span>
                      <span className="display text-[13vw] leading-none group-hover:text-signal">
                        {l.label}
                      </span>
                    </Link>
                  )}
                </motion.div>
              </li>
            ))}
            {signedIn && (
              <li className="overflow-hidden pt-4">
                <button
                  type="button"
                  id="mobile-signout-btn"
                  onClick={async () => {
                    await onSignOut();
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
