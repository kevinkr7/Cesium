import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Search, ArrowUpRight, X } from "lucide-react";
import { toast } from "sonner";
import { setDemo, useDemo } from "@/lib/store";
import { fetchDiscoveryPeople, type DiscoveryCandidate } from "@/services/discovery";
import {
  sendConnectionRequest,
  respondToConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
  fetchConnections,
  fetchPendingRequests,
} from "@/services/connections";
import { blockUser, reportUser, REPORT_REASONS } from "@/services/safety";
import { shared } from "@/lib/data";

import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Cesium" },
      {
        name: "description",
        content:
          "Interesting people, unexpected overlaps. Explore profiles by shared and uncommon interests.",
      },
      { property: "og:title", content: "Discover — Cesium" },
      { property: "og:description", content: "Interesting people, unexpected overlaps." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Discover />
    </RequireAuth>
  ),
});

const filters = [
  "Shared interests",
  "Uncommon connections",
  "Recently discovered",
  "Community interests",
] as const;

function Discover() {
  const demo = useDemo();
  const [q, setQ] = useState("");
  const [f, setF] = useState<string | null>(null);
  const [open, setOpen] = useState<DiscoveryCandidate | null>(null);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [incomingSet, setIncomingSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const mine = [...demo.interests, ...demo.niche];
  const mineKey = demo.interests.join(",") + "::" + demo.niche.join(",");
  const connectionsKey = JSON.stringify(demo.connections);

  useEffect(() => {
    if (!demo.session?.id || demo.session.demo) return;
    const userId = demo.session.id;
    let mounted = true;
    Promise.all([fetchConnections(userId), fetchPendingRequests(userId)])
      .then(([conns, pending]) => {
        if (!mounted) return;
        const incomingIds = new Set<string>();
        const pendingMap: Record<string, "pending"> = {};
        for (const p of pending.incoming) {
          pendingMap[p.userId] = "pending";
          incomingIds.add(p.userId);
        }
        for (const p of pending.outgoing) {
          pendingMap[p.userId] = "pending";
        }
        setIncomingSet(incomingIds);
        setDemo((s) => ({
          connections: { ...s.connections, ...conns, ...pendingMap },
        }));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [demo.session?.id, demo.session?.demo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const currentMine = [...demo.interests, ...demo.niche];
    fetchDiscoveryPeople(currentMine, f, q, demo.connections, {
      primaryInterests: demo.interests.slice(0, 3),
      myStyles: demo.styles,
      blockedUserIds: demo.blockedUsers || [],
      currentUserId: demo.session?.id,
      currentUserHandle: demo.profile?.handle,
      currentUserEmail: demo.session?.email,
    }).then((data) => {
      if (active) {
        // Strict defense-in-depth: Never show self in discover feed
        const selfId = demo.session?.id;
        const selfHandle = demo.profile?.handle?.toLowerCase().replace(/^@/, "");
        const filtered = data.filter((c) => {
          if (c.id === "auride" || c.handle?.toLowerCase() === "@auri") return false;
          if (selfId && c.id === selfId) return false;
          if (selfHandle && c.handle.toLowerCase().replace(/^@/, "") === selfHandle) return false;
          return true;
        });
        setCandidates(filtered);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [
    q,
    f,
    mineKey,
    connectionsKey,
    demo.connections,
    demo.interests,
    demo.niche,
    demo.styles,
    demo.blockedUsers,
    demo.session?.id,
    demo.session?.email,
    demo.profile?.handle,
  ]);

  return (
    <section className="gutter min-h-[100svh] pb-24 pt-32">
      <div className="grid gap-10 md:grid-cols-12">
        <header className="md:col-span-12">
          <p className="label-mono text-muted-foreground">Discover / 001</p>
          <h1 className="display mt-4 max-w-5xl text-[clamp(44px,6.5vw,104px)]">
            Interesting people, unexpected overlaps.
          </h1>
        </header>

        <aside className="md:col-span-3">
          <div className="md:sticky md:top-28">
            <label className="flex items-center gap-3 border-b border-input pb-2 focus-within:border-signal">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search interests, names…"
                aria-label="Search people"
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
            <p className="label-mono mb-3 mt-8 text-muted-foreground">Filter</p>
            <div className="flex flex-wrap gap-2 md:flex-col md:items-start">
              {filters.map((x) => (
                <button
                  key={x}
                  onClick={() => setF(f === x ? null : x)}
                  data-on={f === x}
                  aria-pressed={f === x}
                  className="chip"
                >
                  {f === x && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
                  {x}
                </button>
              ))}
            </div>
            <p className="label-mono mt-8 text-muted-foreground">Your nodes</p>
            <p className="mt-2 text-sm text-muted-foreground">{mine.slice(0, 6).join(" · ")}</p>
            <Link to="/onboarding" className="label-mono mt-3 inline-block text-signal">
              Edit interests →
            </Link>
          </div>
        </aside>

        <div className="md:col-span-9">
          <div className="mb-6 flex items-center justify-between">
            <p className="label-mono text-muted-foreground">{candidates.length} in orbit</p>
            {loading && <p className="label-mono text-signal">Scanning constellation…</p>}
          </div>
          {candidates.length === 0 && !loading ? (
            <div className="flex flex-col items-start border border-dashed border-border p-12">
              <svg width="80" height="40" viewBox="0 0 80 40" aria-hidden>
                <circle cx="10" cy="20" r="4" className="fill-muted-foreground" />
                <circle cx="70" cy="20" r="4" className="fill-none stroke-muted-foreground" />
                <line
                  x1="16"
                  y1="20"
                  x2="64"
                  y2="20"
                  className="stroke-border"
                  strokeDasharray="3 4"
                />
              </svg>
              <p className="display mt-6 text-3xl">
                No one in this orbit. Try widening the search.
              </p>
              <button
                onClick={() => {
                  setQ("");
                  setF(null);
                }}
                className="btn-ghost mt-6"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-6">
              <AnimatePresence mode="popLayout">
                {candidates.map((p, i) => (
                  <ProfileCard
                    key={p.id}
                    p={p}
                    mine={mine}
                    big={!!p.featured && !f && !q}
                    i={i}
                    isIncoming={incomingSet.has(p.id)}
                    onOpen={() => setOpen(p)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <ProfileSheet
            p={open}
            mine={mine}
            isIncoming={incomingSet.has(open.id)}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function ConnectButton({
  id,
  name,
  isIncoming,
}: {
  id: string;
  name: string;
  isIncoming?: boolean | undefined;
}) {
  const { connections, session } = useDemo();
  const st = connections[id];

  const request = async () => {
    const currentUserId = session?.id;
    setDemo((s) => ({ connections: { ...s.connections, [id]: "pending" } }));
    const res = await sendConnectionRequest(id, currentUserId);
    if (res.success) {
      toast.success(`Request sent to ${name.split(" ")[0]}`, {
        description: "Connection request sent. You will be alerted when they accept.",
      });
      window.dispatchEvent(new CustomEvent("cesium:connection-sent", { detail: { targetId: id } }));
    } else {
      setDemo((s) => {
        const next = { ...s.connections };
        delete next[id];
        return { connections: next };
      });
      toast.error(`Could not connect with ${name.split(" ")[0]}`, {
        description: res.error || "Please try again.",
      });
    }
  };

  if (st === "connected") {
    return (
      <Link to="/messages" search={{ c: id }} className="btn-signal !px-4 !py-2.5 text-sm">
        <span>Connected · Message</span>
      </Link>
    );
  }

  if (st === "pending") {
    if (isIncoming) {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const res = await respondToConnectionRequest(id, "accepted", session?.id);
              if (res.success) {
                setDemo((s) => ({ connections: { ...s.connections, [id]: "connected" } }));
                toast.success(`Connected with ${name}`);
                window.dispatchEvent(
                  new CustomEvent("cesium:connection-sent", { detail: { targetId: id } }),
                );
              } else {
                toast.error("Failed to accept connection", { description: res.error ?? undefined });
              }
            }}
            className="btn-signal !px-3 !py-1.5 text-xs font-medium"
            title="Accept connection request"
          >
            Accept
          </button>
          <button
            onClick={async () => {
              await respondToConnectionRequest(id, "declined", session?.id);
              setDemo((s) => {
                const updated = { ...s.connections };
                delete updated[id];
                return { connections: updated };
              });
              toast("Request declined");
              window.dispatchEvent(
                new CustomEvent("cesium:connection-sent", { detail: { targetId: id } }),
              );
            }}
            className="btn-ghost !px-3 !py-1.5 text-xs text-muted-foreground hover:text-destructive"
            title="Decline request"
          >
            Decline
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="label-mono text-xs text-muted-foreground">Pending…</span>
        <button
          onClick={async () => {
            await cancelConnectionRequest(id, session?.id);
            setDemo((s) => {
              const updated = { ...s.connections };
              delete updated[id];
              return { connections: updated };
            });
            toast("Connection request canceled");
            window.dispatchEvent(
              new CustomEvent("cesium:connection-sent", { detail: { targetId: id } }),
            );
          }}
          className="label-mono text-xs text-muted-foreground underline hover:text-destructive"
          title="Cancel request"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={request} className="btn-ghost !py-2.5 text-sm">
      Request connection
    </button>
  );
}

function ProfileCard({
  p,
  mine,
  big,
  i,
  isIncoming,
  onOpen,
}: {
  p: DiscoveryCandidate;
  mine: string[];
  big: boolean;
  i: number;
  isIncoming?: boolean | undefined;
  onOpen: () => void;
}) {
  const s = p.sharedInterests.length > 0 ? p.sharedInterests : shared(p.interests, mine);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex flex-col border border-border bg-surface/30 transition-colors hover:border-foreground/30 ${
        big ? "md:col-span-3 md:row-span-2" : "md:col-span-3 lg:col-span-2"
      }`}
    >
      {p.photo ? (
        <button
          onClick={onOpen}
          className={`overflow-hidden ${big ? "aspect-[4/3]" : "aspect-[16/9]"}`}
          aria-label={`View ${p.name}`}
        >
          <img
            src={p.photo}
            alt={p.name}
            loading="lazy"
            width={768}
            height={960}
            className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-[1.03] group-hover:grayscale-0"
          />
        </button>
      ) : (
        <button
          onClick={onOpen}
          className="flex aspect-[16/9] items-center justify-center bg-surface-2"
          aria-label={`View ${p.name}`}
        >
          <span className="display text-6xl text-muted-foreground">
            {p.name
              .split(" ")
              .map((x) => x[0])
              .join("")}
          </span>
        </button>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={`font-display font-bold ${big ? "text-3xl" : "text-xl"}`}>{p.name}</h2>
          <span className="label-mono text-muted-foreground">{p.city}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="label-mono text-muted-foreground">{p.handle}</p>
          {p.matchScore > 0 && (
            <span className="label-mono text-signal">{p.matchScore}% overlap</span>
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{p.bio}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {p.interests.map((x) => (
            <span
              key={x}
              className={`chip !py-0.5 !text-xs ${
                s.includes(x) ? "group-hover:chip-shared chip-shared" : "text-muted-foreground"
              }`}
            >
              {x}
            </span>
          ))}
        </div>
        {p.uncommonGround?.anchor && s.length <= 1 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-signal">
            <span className="label-mono">Anchor:</span>
            <span>{p.uncommonGround.anchor}</span>
          </div>
        )}
        <p className="mt-4 border-l border-signal pl-3 text-sm">{p.why}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <ConnectButton id={p.id} name={p.name} isIncoming={isIncoming} />
          <button
            onClick={onOpen}
            className="label-mono ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            View <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function ProfileSheet({
  p,
  mine,
  isIncoming,
  onClose,
}: {
  p: DiscoveryCandidate;
  mine: string[];
  isIncoming?: boolean | undefined;
  onClose: () => void;
}) {
  const demo = useDemo();
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const s = p.sharedInterests.length > 0 ? p.sharedInterests : shared(p.interests, mine);
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex justify-end bg-background/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${p.name}'s profile`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background p-8 md:p-12"
      >
        <div className="flex items-center justify-between">
          <p className="label-mono text-signal">
            Orbit profile {p.matchScore > 0 ? `· ${p.matchScore}% overlap` : ""}
          </p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {p.photo && (
          <div className="mt-8 aspect-[16/10] overflow-hidden">
            <img
              src={p.photo}
              alt={p.name}
              width={768}
              height={960}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <h2 className="display mt-6 text-4xl">{p.name}</h2>
        <p className="label-mono text-muted-foreground">
          {p.handle} · {p.city}
        </p>
        <p className="mt-4 text-muted-foreground">{p.bio}</p>
        <p className="label-mono mb-2 mt-8 text-muted-foreground">Shared with you ({s.length})</p>
        <div className="flex flex-wrap gap-2">
          {s.map((x) => (
            <span key={x} className="chip chip-shared">
              {x}
            </span>
          ))}
          {s.length === 0 && (
            <span className="text-sm text-muted-foreground">No shared interests yet.</span>
          )}
        </div>
        <p className="label-mono mb-2 mt-6 text-muted-foreground">Their other interests</p>
        <div className="flex flex-wrap gap-2">
          {p.interests
            .filter((x) => !s.includes(x))
            .map((x) => (
              <span key={x} className="chip text-muted-foreground">
                {x}
              </span>
            ))}
        </div>
        <div className="mt-8 border-t border-border pt-6">
          <p className="label-mono text-signal">Overlap engine note</p>
          <p className="mt-2 text-lg">{p.why}</p>
        </div>
        {p.uncommonGround && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="label-mono text-signal">Uncommon Ground perspective</p>
            <div className="mt-2 space-y-1.5 text-xs">
              {p.uncommonGround.anchor && (
                <p>
                  <span className="text-muted-foreground">Shared Anchor:</span>{" "}
                  <span className="font-semibold text-foreground">{p.uncommonGround.anchor}</span>
                </p>
              )}
              {p.uncommonGround.novelCategories.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Novel Horizons:</span>{" "}
                  <span className="font-semibold text-foreground">
                    {p.uncommonGround.novelCategories.join(", ")}
                  </span>
                </p>
              )}
              <p className="label-mono text-[11px] text-muted-foreground">
                Serendipity index: {p.uncommonGround.contrastScore}%
              </p>
            </div>
          </div>
        )}
        <div className="mt-auto pt-8">
          <ConnectButton id={p.id} name={p.name} isIncoming={isIncoming} />
          {(demo.connections[p.id] === "connected" || p.connectionStatus === "connected") && (
            <button
              onClick={async () => {
                await removeConnection(p.id);
                setDemo((s) => {
                  const updated = { ...s.connections };
                  delete updated[p.id];
                  return { connections: updated };
                });
                toast("Connection removed");
                onClose();
              }}
              className="mt-3 block label-mono text-xs text-destructive hover:underline"
            >
              Disconnect / Remove connection
            </button>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <button
              onClick={() => setShowReport(true)}
              className="label-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Report profile
            </button>
            <button
              onClick={async () => {
                if (
                  window.confirm(
                    `Are you sure you want to block ${p.name}? They will no longer appear in your discovery feed or conversations.`,
                  )
                ) {
                  await blockUser(p.id);
                  toast(`Blocked ${p.name}`);
                  onClose();
                }
              }}
              className="label-mono text-xs text-destructive/80 transition-colors hover:text-destructive hover:underline"
            >
              Block user
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showReport && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md border border-border bg-surface p-6 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold">Report {p.name}</h3>
                  <button onClick={() => setShowReport(false)} aria-label="Close report">
                    <X size={16} />
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Help us keep Cesium safe. Reports are reviewed in accordance with community
                  guidelines.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="label-mono text-xs text-muted-foreground block mb-1">
                      Reason
                    </label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:border-signal"
                    >
                      {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-mono text-xs text-muted-foreground block mb-1">
                      Additional details (optional)
                    </label>
                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Describe what occurred…"
                      rows={3}
                      maxLength={1000}
                      className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:border-signal"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowReport(false)}
                    className="btn-ghost !py-1.5 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submittingReport}
                    onClick={async () => {
                      setSubmittingReport(true);
                      const res = await reportUser(p.id, reportReason, reportDetails);
                      setSubmittingReport(false);
                      if (res.success) {
                        toast.success("Thank you. Your report has been submitted.");
                        setShowReport(false);
                      } else {
                        toast.error(res.error || "Failed to submit report");
                      }
                    }}
                    className="btn-signal !py-1.5 text-xs"
                  >
                    {submittingReport ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.aside>
    </motion.div>
  );
}
