import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { communities, people } from "@/lib/data";
import { useDemo } from "@/lib/store";
import { JoinButton } from "@/components/JoinButton";
import {
  createCommunityThread,
  createCommunityReply,
  deleteCommunityThread,
} from "@/services/communities";
import { checkContentSafety, reportContent, REPORT_REASONS } from "@/services/safety";

import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/communities/$id")({
  head: ({ params }) => {
    const c = communities.find((x) => x.id === params.id);
    const t = c ? `${c.name} — Cesium` : "Community — Cesium";
    return {
      meta: [
        { title: t },
        { name: "description", content: c?.line ?? "A Cesium micro-community." },
        { property: "og:title", content: t },
        { property: "og:description", content: c?.line ?? "A Cesium micro-community." },
      ],
    };
  },
  component: () => (
    <RequireAuth>
      <Detail />
    </RequireAuth>
  ),
});

type ThreadItem = {
  id?: string | undefined;
  title: string;
  content?: string | undefined;
  author: string;
  authorId?: string | undefined;
  replies: { id?: string | undefined; author: string; text: string }[];
};

function Detail() {
  const { id } = Route.useParams();
  const demo = useDemo();
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
  const [showNewThread, setShowNewThread] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [reportTarget, setReportTarget] = useState<{
    type: "post" | "reply";
    id: string;
    title: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const c = [...communities, ...demo.custom].find((x) => x.id === id);

  if (!c) {
    return (
      <section className="gutter pt-40">
        <p className="display text-4xl">This orbit is empty.</p>
        <Link to="/communities" className="btn-ghost mt-6">
          Back to communities
        </Link>
      </section>
    );
  }

  const allThreads: ThreadItem[] = [
    ...threads,
    ...c.threads.map((t) => ({
      title: t.title,
      author: t.author,
      replies: t.replies.map((r) => ({ author: r.author, text: r.text })),
    })),
  ];
  const members = people.filter((p) => c.memberIds.includes(p.id));
  const count = c.members + (demo.joined.includes(c.id) && !c.custom ? 1 : 0);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim().length < 3) return;

    const titleSafety = checkContentSafety(newTitle);
    const contentSafety = checkContentSafety(newContent);
    if (!titleSafety.safe || !contentSafety.safe) {
      toast.error("Thread contains prohibited language and cannot be posted.");
      return;
    }

    const authorName = demo.session?.name ?? "You";
    const authorId = demo.session?.id ?? "me";
    const postUuid = crypto.randomUUID();

    const newThread: ThreadItem = {
      id: postUuid,
      title: newTitle.trim(),
      content: newContent.trim() || undefined,
      author: authorName,
      authorId,
      replies: [],
    };

    setThreads((prev) => [newThread, ...prev]);

    if (demo.session?.id && !demo.session.demo) {
      await createCommunityThread(c.id, demo.session.id, newTitle.trim(), newContent.trim());
    }

    setNewTitle("");
    setNewContent("");
    setShowNewThread(false);
    toast.success("Thread posted");
  };

  const handleReply = async (index: number, thread: ThreadItem) => {
    const text = replyTexts[index]?.trim();
    if (!text) return;

    const replySafety = checkContentSafety(text);
    if (!replySafety.safe) {
      toast.error("Reply contains prohibited language and cannot be posted.");
      return;
    }

    const authorName = demo.session?.name ?? "You";
    const authorId = demo.session?.id ?? "me";
    const replyUuid = crypto.randomUUID();

    // Optimistically update thread replies
    setThreads((prev) => {
      const copy = [...prev];
      const matchIdx = copy.findIndex((t) => t.title === thread.title);
      if (matchIdx !== -1) {
        copy[matchIdx] = {
          ...copy[matchIdx]!,
          replies: [...copy[matchIdx]!.replies, { id: replyUuid, author: authorName, text }],
        };
        return copy;
      }
      return [
        {
          ...thread,
          replies: [...thread.replies, { id: replyUuid, author: authorName, text }],
        },
        ...prev,
      ];
    });

    setReplyTexts((prev) => ({ ...prev, [index]: "" }));

    if (thread.id && demo.session?.id && !demo.session.demo) {
      await createCommunityReply(thread.id, demo.session.id, text);
    }

    toast.success("Reply added");
  };

  const handleDeleteThread = async (thread: ThreadItem) => {
    setThreads((prev) => prev.filter((t) => t.title !== thread.title));
    if (thread.id && demo.session?.id && !demo.session.demo) {
      await deleteCommunityThread(thread.id, demo.session.id);
    }
    toast("Thread deleted");
  };

  return (
    <section className="gutter min-h-[100svh] pb-24 pt-32">
      <Link
        to="/communities"
        className="label-mono inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={12} /> Communities
      </Link>
      <div className="relative mt-8 overflow-hidden border border-border p-8 md:p-14">
        <svg
          className="absolute -right-20 -top-20 h-96 w-96 text-border"
          viewBox="0 0 100 100"
          aria-hidden
        >
          {[45, 32, 20].map((r) => (
            <circle
              key={r}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.3"
            />
          ))}
          <circle cx="95" cy="50" r="1.5" className="fill-signal" />
        </svg>
        <p className="label-mono text-signal">{c.topics.join(" / ")}</p>
        <h1 className="display relative mt-4 text-[clamp(48px,8vw,140px)]">{c.name}</h1>
        <p className="relative mt-4 max-w-xl text-lg text-muted-foreground">{c.description}</p>
        <div className="relative mt-8 flex items-center gap-6">
          <JoinButton id={c.id} />
          <span className="label-mono text-muted-foreground">{count} members</span>
        </div>
      </div>

      <div className="mt-16 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="label-mono text-muted-foreground">Threads</p>
            <button
              onClick={() => setShowNewThread((s) => !s)}
              className="label-mono inline-flex items-center gap-1 text-signal hover:underline"
            >
              <Plus size={14} /> New thread
            </button>
          </div>

          <AnimatePresence>
            {showNewThread && (
              <motion.form
                onSubmit={handleCreateThread}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden border border-border p-4"
              >
                <div className="field">
                  <input
                    id="thread-title"
                    placeholder=" "
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                  <label htmlFor="thread-title">Start a discussion…</label>
                  <span className="line" />
                </div>
                <div className="mt-3">
                  <textarea
                    rows={2}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Optional thoughts, questions, or context…"
                    className="w-full border border-input bg-transparent p-2.5 text-sm outline-none focus:border-signal"
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewThread(false)}
                    className="btn-ghost !py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={newTitle.trim().length < 3}
                    className="btn-signal !py-1.5 text-xs"
                  >
                    Post thread
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {allThreads.length === 0 && (
            <p className="text-muted-foreground">Quiet in here. The first thread is yours.</p>
          )}
          <ul className="divide-y divide-border border-y border-border">
            {allThreads.map((t, i) => (
              <li key={`${t.title}-${i}`}>
                <div className="flex w-full items-start justify-between gap-4 py-5 text-left">
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    aria-expanded={open === i}
                    className="flex-1 text-left"
                  >
                    <span className="font-display text-xl font-semibold">{t.title}</span>
                    <span className="label-mono mt-1 block text-muted-foreground">
                      {t.author} · {t.replies.length} replies
                    </span>
                  </button>
                  <div className="flex items-center gap-3">
                    {t.author === (demo.session?.name ?? "You") ? (
                      <button
                        onClick={() => handleDeleteThread(t)}
                        title="Delete thread"
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setReportTarget({
                            type: "post",
                            id: t.id || t.title,
                            title: t.title,
                          })
                        }
                        title="Report thread"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Flag size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => setOpen(open === i ? null : i)}
                      className="label-mono text-signal"
                    >
                      {open === i ? "−" : "+"}
                    </button>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {t.content && (
                        <p className="mb-4 pl-4 text-sm text-foreground/90">{t.content}</p>
                      )}
                      <ul className="space-y-3 pb-3 pl-4">
                        {t.replies.map((r, j) => (
                          <li key={j} className="border-l border-border pl-4">
                            <div className="flex items-center justify-between">
                              <p className="label-mono text-muted-foreground">{r.author}</p>
                              {r.author !== (demo.session?.name ?? "You") && (
                                <button
                                  onClick={() =>
                                    setReportTarget({
                                      type: "reply",
                                      id: r.id || `${t.title}-${j}`,
                                      title: `Reply by ${r.author}`,
                                    })
                                  }
                                  className="label-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  Report
                                </button>
                              )}
                            </div>
                            <p className="mt-1 text-sm">{r.text}</p>
                          </li>
                        ))}
                        {!t.replies.length && (
                          <li className="text-sm text-muted-foreground">No replies yet.</li>
                        )}
                      </ul>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleReply(i, t);
                        }}
                        className="mb-4 flex items-center gap-2 pl-4"
                      >
                        <input
                          value={replyTexts[i] ?? ""}
                          onChange={(e) =>
                            setReplyTexts((prev) => ({ ...prev, [i]: e.target.value }))
                          }
                          placeholder="Write a reply…"
                          className="flex-1 border-b border-input bg-transparent py-1.5 text-sm outline-none focus:border-signal"
                        />
                        <button
                          type="submit"
                          disabled={!replyTexts[i]?.trim()}
                          className="btn-signal !px-3 !py-1 text-xs"
                        >
                          Reply
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        </div>
        <aside className="md:col-span-4">
          <p className="label-mono mb-4 text-muted-foreground">Some members</p>
          <ul className="space-y-4">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                {m.photo ? (
                  <img
                    src={m.photo}
                    alt={m.name}
                    loading="lazy"
                    width={768}
                    height={960}
                    className="h-12 w-12 object-cover grayscale"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center bg-surface-2 font-display">
                    {m.name[0]}
                  </span>
                )}
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="label-mono text-muted-foreground">{m.city}</p>
                </div>
              </li>
            ))}
            {!members.length && (
              <li className="text-sm text-muted-foreground">Just you, for now.</li>
            )}
          </ul>
        </aside>
      </div>

      <AnimatePresence>
        {reportTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md border border-border bg-surface p-6 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">Report Content</h3>
                <button onClick={() => setReportTarget(null)} aria-label="Close report">
                  <X size={16} />
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Reporting:{" "}
                <span className="font-semibold text-foreground">{reportTarget.title}</span>
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
                  onClick={() => setReportTarget(null)}
                  className="btn-ghost !py-1.5 text-xs text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  disabled={submittingReport}
                  onClick={async () => {
                    setSubmittingReport(true);
                    const res = await reportContent(
                      reportTarget.type,
                      reportTarget.id,
                      reportReason,
                      reportDetails,
                    );
                    setSubmittingReport(false);
                    if (res.success) {
                      toast.success("Thank you. Content report submitted.");
                      setReportTarget(null);
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
