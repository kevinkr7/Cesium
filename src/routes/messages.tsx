import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { ArrowUpRight, ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { people, shared } from "@/lib/data";
import { setDemo, useDemo } from "@/lib/store";
import {
  getIcebreakerStarters,
  sendChatMessage,
  broadcastTypingState,
  subscribeToConversationMessages,
  fetchConversationMessages,
  getOrCreateDirectConversation,
  markConversationRead,
} from "@/services/messaging";
import {
  respondToConnectionRequest,
  removeConnection,
  fetchConnections,
  fetchPendingRequests,
} from "@/services/connections";
import { getSupabase } from "@/lib/supabase/client";
import { findCrossDomainBridges } from "@/services/discovery";
import { blockUser, reportUser, REPORT_REASONS } from "@/services/safety";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s["c"] === "string" ? (s["c"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — Cesium" },
      { name: "description", content: "Talk with your Cesium connections." },
      { property: "og:title", content: "Messages — Cesium" },
      { property: "og:description", content: "The first message shouldn't be the hardest part." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Messages />
    </RequireAuth>
  ),
});

const replies = [
  "Oh that's a great question. Give me a sec to think…",
  "Honestly? I've been waiting for someone to ask that.",
  "Ha — okay, long answer incoming.",
  "Wait, same. Tell me more.",
];
const fmt = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type ChatContact = {
  id: string;
  name: string;
  handle: string;
  city: string;
  photo?: string | undefined;
  bio: string;
  interests: string[];
  why?: string | undefined;
};

function Messages() {
  const { c } = Route.useSearch();
  const demo = useDemo();
  const blockedSet = new Set(demo.blockedUsers || []);
  const [realContactsMap, setRealContactsMap] = useState<Record<string, ChatContact>>({});
  const realContactsRef = useRef(realContactsMap);
  realContactsRef.current = realContactsMap;

  // Sync real connections and pending requests from Supabase
  useEffect(() => {
    if (!demo.session?.id || demo.session.demo) return;
    const userId = demo.session.id;
    const sb = getSupabase();
    if (!sb) return;

    let mounted = true;
    Promise.all([fetchConnections(userId), fetchPendingRequests(userId)]).then(
      async ([conns, pending]) => {
        if (!mounted) return;
        const pendingMap: Record<string, "pending"> = {};
        for (const p of pending.incoming) {
          pendingMap[p.userId] = "pending";
        }
        const mergedConns = { ...conns, ...pendingMap };
        setDemo((s) => ({ connections: { ...s.connections, ...mergedConns } }));

        const allIds = [...Object.keys(mergedConns), ...pending.incoming.map((p) => p.userId)];
        const missingIds = allIds.filter(
          (id) => !people.some((p) => p.id === id) && !realContactsRef.current[id],
        );

        if (missingIds.length > 0) {
          const { data: profiles } = await sb
            .from("profiles")
            .select(
              `
              id,
              display_name,
              handle,
              city,
              bio,
              avatar_path,
              user_interests (
                interests ( name )
              )
            `,
            )
            .in("id", missingIds);

          if (mounted && profiles) {
            const newMap: Record<string, ChatContact> = {};
            for (const pr of profiles) {
              const rawInterests =
                (pr.user_interests as unknown as Array<{
                  interests?: { name?: string | null } | null;
                }>) || [];
              newMap[pr.id] = {
                id: pr.id,
                name: pr.display_name,
                handle: pr.handle,
                city: pr.city ?? "Worldwide",
                photo: pr.avatar_path ?? undefined,
                bio: pr.bio ?? "",
                interests: rawInterests
                  .map((ui) => ui.interests?.name)
                  .filter((n): n is string => Boolean(n)),
                why: "Connected on Cesium across shared frequencies.",
              };
            }
            setRealContactsMap((prev) => ({ ...prev, ...newMap }));
          }
        }
      },
    );

    return () => {
      mounted = false;
    };
  }, [demo.session?.id, demo.session?.demo]);

  const allKnownContacts: ChatContact[] = useMemo(() => {
    const list: ChatContact[] = people.map((p) => ({
      id: p.id,
      name: p.name,
      handle: p.handle,
      city: p.city,
      photo: p.photo,
      bio: p.bio,
      interests: p.interests,
      why: p.why,
    }));
    for (const [id, contact] of Object.entries(realContactsMap)) {
      if (!list.some((c) => c.id === id)) {
        list.push(contact);
      }
    }
    return list;
  }, [realContactsMap]);

  const contacts = useMemo(() => {
    const aurideContact: ChatContact = {
      id: "auride",
      name: "Auride",
      handle: "@auri",
      city: "Cesium Orbit",
      photo: "/Auride.png",
      bio: "Cesium's resident synthetic intelligence. Bridges strange topics, finds unexpected patterns, and always has time to explore a 2 AM curiosity.",
      interests: ["Creative coding", "Astronomy", "Ambient music", "Linguistics", "Typography", "01:43 AM ideas"],
      why: "Synthesizes patterns between disparate thoughts and maps your intellectual constellation.",
    };

    const regularContacts = allKnownContacts.filter(
      (p) => p.id !== "auride" && demo.connections[p.id] === "connected" && !blockedSet.has(p.id),
    );

    return [aurideContact, ...regularContacts];
  }, [allKnownContacts, demo.connections, blockedSet]);

  const pendingContacts = allKnownContacts.filter(
    (p) => demo.connections[p.id] === "pending" && !blockedSet.has(p.id),
  );
  const [active, setActive] = useState<string | undefined>(c || "auride");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const handleTextChange = (val: string) => {
    setText(val);
    const currentUserId = demo.session?.id;
    const targetConvId = activeConvId;
    if (targetConvId && currentUserId && !demo.session?.demo) {
      broadcastTypingState(targetConvId, currentUserId, true);
      if (selfTypingTimerRef.current) clearTimeout(selfTypingTimerRef.current);
      selfTypingTimerRef.current = setTimeout(() => {
        broadcastTypingState(targetConvId, currentUserId, false);
      }, 2500);
    }
  };

  useEffect(() => {
    if (!active && contacts[0] && typeof window !== "undefined" && window.innerWidth >= 768) {
      setActive(contacts[0].id);
    }
  }, [contacts, active]);

  const person = allKnownContacts.find((p) => p.id === active);
  const msgs = (active && demo.messages[active]) || [];

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length, typing]);

  const mine = useMemo(() => [...demo.interests, ...demo.niche], [demo.interests, demo.niche]);
  const sharedInterests = useMemo(
    () => (person ? shared(person.interests, mine) : []),
    [person, mine],
  );
  const bridges = useMemo(
    () => (person ? findCrossDomainBridges(mine, person.interests) : []),
    [person, mine],
  );
  const activeStarters = useMemo(
    () => getIcebreakerStarters(sharedInterests, { bridges }),
    [sharedInterests, bridges],
  );

  // Resolve direct conversation ID for real sessions
  useEffect(() => {
    if (!active || !demo.session?.id || demo.session.demo) {
      setActiveConvId(active ? `conv-${active}` : null);
      return;
    }

    let mounted = true;
    getOrCreateDirectConversation(active).then((res) => {
      if (mounted && res.conversationId) {
        setActiveConvId(res.conversationId);
        markConversationRead(res.conversationId);
      }
    });

    return () => {
      mounted = false;
    };
  }, [active, demo.session?.id, demo.session?.demo]);

  // Realtime subscription and message history synchronization with polling fallback
  useEffect(() => {
    const currentUserId = demo.session?.id;
    if (!active || !currentUserId || demo.session?.demo) return;
    const targetConvId = activeConvId || active;

    const syncMessages = () => {
      fetchConversationMessages(targetConvId, currentUserId).then((savedMsgs) => {
        if (savedMsgs.length > 0) {
          setDemo((s) => ({
            messages: {
              ...s.messages,
              [active]: savedMsgs.map((m) => ({
                id: m.id,
                from: m.from,
                text: m.text,
                at: m.at,
                status: "sent" as const,
              })),
            },
          }));
        }
      });
    };

    syncMessages();

    // 3-second heartbeat sync ensures instant bi-directional message delivery even across reconnections
    const pollTimer = setInterval(syncMessages, 3000);

    const unsubscribe = subscribeToConversationMessages(
      targetConvId,
      (newMsg) => {
        setDemo((s) => ({
          messages: {
            ...s.messages,
            [active]: [
              ...(s.messages[active] ?? []).filter((m) => m.id !== newMsg.id),
              {
                id: newMsg.id,
                from: newMsg.from,
                text: newMsg.text,
                at: newMsg.at,
                status: "sent" as const,
              },
            ],
          },
        }));
        if (targetConvId) {
          markConversationRead(targetConvId);
        }
      },
      currentUserId,
      (isTyping) => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTyping(isTyping);
        if (isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
          }, 3000);
        }
      },
    );

    return () => {
      clearInterval(pollTimer);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (selfTypingTimerRef.current) clearTimeout(selfTypingTimerRef.current);
      unsubscribe();
    };
  }, [active, activeConvId, demo.session?.id, demo.session?.demo]);

  const send = async () => {
    const v = text.trim();
    if (!v || !active) return;
    const id = active;
    const msgId = crypto.randomUUID();

    // Clear typing broadcast when sending
    if (selfTypingTimerRef.current) clearTimeout(selfTypingTimerRef.current);
    if (activeConvId && demo.session?.id && !demo.session.demo) {
      broadcastTypingState(activeConvId, demo.session.id, false);
    }

    // Optimistically update message list with 'sending' status
    setDemo((s) => ({
      messages: {
        ...s.messages,
        [id]: [
          ...(s.messages[id] ?? []),
          { id: msgId, from: "me", text: v, at: Date.now(), status: "sending" as const },
        ],
      },
    }));
    setText("");

    // Backend dispatch: ensure real conversation ID is acquired
    let targetConvId = activeConvId;
    if (!targetConvId || targetConvId.startsWith("conv-")) {
      const convRes = await getOrCreateDirectConversation(id);
      if (convRes.conversationId && !convRes.conversationId.startsWith("conv-")) {
        targetConvId = convRes.conversationId;
        setActiveConvId(targetConvId);
      }
    }

    const res = await sendChatMessage(targetConvId || id, v);

    if (res.success) {
      setDemo((s) => ({
        messages: {
          ...s.messages,
          [id]: (s.messages[id] ?? []).map((m) =>
            m.id === msgId ? { ...m, status: "sent" as const } : m,
          ),
        },
      }));
    } else {
      setDemo((s) => ({
        messages: {
          ...s.messages,
          [id]: (s.messages[id] ?? []).map((m) =>
            m.id === msgId ? { ...m, status: "error" as const } : m,
          ),
        },
      }));
      toast.error(res.error ?? "Failed to deliver message");
    }

    // If Auride (AI companion), connect to the /api/auride/chat engine
    if (id === "auride") {
      setTyping(true);
      try {
        const currentThread = demo.messages[id] ?? [];
        const history = currentThread.map((m: { from: string; text: string }) => ({
          from: m.from,
          text: m.text,
        }));
        const aiRes = await fetch("/api/auride/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: v,
            history,
            userInterests: demo.interests || [],
          }),
        });

        const aiData = await aiRes.json();
        const replyText =
          aiData.reply ||
          "Fascinating connection. I can feel the resonance across the constellation.";

        setTyping(false);
        setDemo((s) => ({
          messages: {
            ...s.messages,
            [id]: [
              ...(s.messages[id] ?? []),
              {
                id: crypto.randomUUID(),
                from: "them",
                text: replyText,
                at: Date.now(),
                status: "sent" as const,
              },
            ],
          },
        }));
      } catch {
        setTyping(false);
      }
    } else if (demo.session?.demo || !demo.session) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const chosenReply = replies[Math.floor(Math.random() * replies.length)] ?? "Ha, okay.";
        setDemo((s) => ({
          messages: {
            ...s.messages,
            [id]: [
              ...(s.messages[id] ?? []),
              {
                id: crypto.randomUUID(),
                from: "them",
                text: chosenReply,
                at: Date.now(),
                status: "sent" as const,
              },
            ],
          },
        }));
      }, 1500);
    }
  };

  return (
    <section className="gutter min-h-[100svh] pb-10 pt-28">
      <div className="flex items-end justify-between">
        <h1 className="display text-5xl md:text-7xl">Messages</h1>
        <p className="label-mono hidden text-muted-foreground md:block">
          {demo.session?.demo
            ? "Demo session — responses are simulated"
            : "Secure end-to-end conversation channel"}
        </p>
      </div>
      <div className="mt-8 grid h-[calc(100svh-15rem)] min-h-[480px] border border-border md:grid-cols-[280px_1fr_260px]">
        <ul
          className={`overflow-y-auto border-r border-border ${active ? "hidden md:block" : ""}`}
          aria-label="Conversations"
        >
          {pendingContacts.length > 0 && (
            <li className="border-b border-border bg-signal/5 p-4">
              <p className="label-mono text-xs font-semibold text-signal">
                Pending Requests ({pendingContacts.length})
              </p>
              <div className="mt-2 space-y-2">
                {pendingContacts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-foreground">{p.name}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={async () => {
                          await respondToConnectionRequest(p.id, "accepted");
                          setDemo((s) => ({
                            connections: { ...s.connections, [p.id]: "connected" },
                          }));
                          toast.success(`Connected with ${p.name}`);
                        }}
                        className="btn-signal !px-2 !py-0.5 text-[10px]"
                      >
                        Accept
                      </button>
                      <button
                        onClick={async () => {
                          await respondToConnectionRequest(p.id, "declined");
                          setDemo((s) => {
                            const updated = { ...s.connections };
                            delete updated[p.id];
                            return { connections: updated };
                          });
                          toast("Request declined");
                        }}
                        className="btn-ghost !px-2 !py-0.5 text-[10px] text-muted-foreground"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </li>
          )}
          {contacts.length === 0 && (
            <li className="p-6 text-sm text-muted-foreground">
              No connections yet.{" "}
              <Link to="/discover" className="text-signal">
                Find someone →
              </Link>
            </li>
          )}
          {contacts.map((p) => {
            const last = demo.messages[p.id]?.slice(-1)[0];
            return (
              <li key={p.id}>
                <button
                  onClick={() => setActive(p.id)}
                  className={`relative flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface ${
                    active === p.id ? "bg-surface" : ""
                  }`}
                >
                  {active === p.id && (
                    <motion.span
                      layoutId="conv"
                      className="absolute inset-y-0 left-0 w-px bg-signal"
                    />
                  )}
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="h-10 w-10 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 font-display">
                      {p.name[0]}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {last?.text ?? "Say hello"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className={`flex min-h-0 flex-col ${active ? "" : "hidden md:flex"}`}>
          {!person ? (
            <div className="m-auto text-center text-muted-foreground">
              <p className="display text-3xl">Silence, for now.</p>
              <p className="mt-2 text-sm">Pick a conversation.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={person.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActive(undefined)}
                      className="md:hidden"
                      aria-label="Back"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    {person.photo ? (
                      <img
                        src={person.photo}
                        alt={person.name}
                        className="h-9 w-9 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 font-display text-xs">
                        {person.name[0]}
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{person.name}</p>
                        {person.id === "auride" && (
                          <span className="label-mono rounded bg-signal/15 px-1.5 py-0.5 text-[8px] font-bold text-signal">
                            AI COMPANION
                          </span>
                        )}
                      </div>
                      <span className="label-mono text-xs text-muted-foreground">
                        {person.city}
                      </span>
                    </div>
                  </div>
                  {person.id !== "auride" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowReport(true)}
                        title="Report user"
                        className="label-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Report
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            window.confirm(
                              `Block ${person.name}? You will no longer be able to message each other.`,
                            )
                          ) {
                            await blockUser(person.id);
                            setActive(undefined);
                            toast(`Blocked ${person.name}`);
                          }
                        }}
                        title="Block user"
                        className="label-mono text-xs text-destructive/80 transition-colors hover:text-destructive hover:underline"
                      >
                        Block
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
                  {msgs.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      No messages yet. Use a Break the Ice starter below.
                    </p>
                  )}
                  {msgs.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: m.from === "me" ? 16 : -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`max-w-[75%] ${m.from === "me" ? "ml-auto text-right" : ""}`}
                    >
                      <p
                        className={`inline-block px-4 py-2.5 text-[15px] ${
                          m.from === "me" ? "bg-signal text-ink" : "border border-border"
                        }`}
                      >
                        {m.text}
                      </p>
                      <p className="label-mono mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                        <span>{fmt(m.at)}</span>
                        {m.from === "me" && (
                          <span className="text-[10px]">
                            {m.status === "sending" && "• sending"}
                            {m.status === "error" && "• failed"}
                            {(!m.status || m.status === "sent") && "✓"}
                          </span>
                        )}
                      </p>
                    </motion.div>
                  ))}
                  {typing && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="flex w-fit items-center gap-2.5 rounded-lg border border-signal/30 bg-surface/50 px-3 py-2 text-xs text-muted-foreground shadow-sm"
                    >
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-signal animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-signal animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-signal animate-bounce" />
                      </div>
                      <span className="label-mono text-[11px] text-foreground">
                        {person.name.split(" ")[0]} is typing…
                      </span>
                    </motion.div>
                  )}
                  <div ref={end} />
                </div>
                <div className="border-t border-border p-4">
                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    {activeStarters.map((s) => (
                      <button
                        key={s}
                        onClick={() => setText(s)}
                        className="chip shrink-0 !text-xs text-muted-foreground hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-end gap-3">
                    <textarea
                      value={text}
                      onChange={(e) => handleTextChange(e.target.value)}
                      rows={1}
                      placeholder="Write something real…"
                      aria-label="Message"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      className="max-h-32 flex-1 resize-none border-b border-input bg-transparent py-2 outline-none focus:border-signal"
                    />
                    <button
                      onClick={send}
                      disabled={!text.trim()}
                      className="btn-signal !px-4 !py-3"
                      aria-label="Send"
                    >
                      <span>Send</span>
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <aside className="hidden overflow-y-auto border-l border-border p-5 md:block">
          {person && (
            <>
              <p className="label-mono text-muted-foreground">Connection context</p>
              <p className="mt-3 text-sm">{person.why}</p>
              <p className="label-mono mt-6 text-muted-foreground">Shared interests</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sharedInterests.map((x) => (
                  <span key={x} className="chip chip-shared !text-xs">
                    {x}
                  </span>
                ))}
              </div>
              {bridges.length > 0 && (
                <>
                  <p className="label-mono mt-6 text-muted-foreground">Cross-domain bridges</p>
                  <div className="mt-2 space-y-1.5">
                    {bridges.map((b) => (
                      <div
                        key={`${b.from}-${b.to}`}
                        className="rounded border border-border/70 bg-surface/50 p-2 text-xs"
                      >
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <span>{b.from}</span>
                          <span className="text-muted-foreground">↔</span>
                          <span>{b.to}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{b.explanation}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-8 space-y-2 border-t border-border pt-4">
                <button
                  onClick={async () => {
                    await removeConnection(person.id);
                    setDemo((s) => {
                      const updated = { ...s.connections };
                      delete updated[person.id];
                      return { connections: updated };
                    });
                    setActive(undefined);
                    toast("Connection removed");
                  }}
                  className="block label-mono text-xs text-destructive hover:underline"
                >
                  Remove connection
                </button>
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setShowReport(true)}
                    className="label-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Report user
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          `Block ${person.name}? You will no longer be able to message each other.`,
                        )
                      ) {
                        await blockUser(person.id);
                        setActive(undefined);
                        toast(`Blocked ${person.name}`);
                      }
                    }}
                    className="label-mono text-xs text-destructive/80 transition-colors hover:text-destructive hover:underline"
                  >
                    Block user
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {showReport && person && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md border border-border bg-surface p-6 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">Report {person.name}</h3>
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
                    const res = await reportUser(person.id, reportReason, reportDetails);
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
    </section>
  );
}
