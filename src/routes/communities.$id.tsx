import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { communities, people } from "@/lib/data";
import { setDemo, useDemo } from "@/lib/store";
import { JoinButton } from "@/components/JoinButton";
import { createCommunityThread } from "@/services/communities";

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

function Detail() {
  const { id } = Route.useParams();
  const demo = useDemo();
  const [threads, setThreads] = useState<
    { title: string; author: string; replies: { author: string; text: string }[] }[]
  >([]);
  const [newTitle, setNewTitle] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [open, setOpen] = useState<number | null>(0);

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

  const allThreads = [...c.threads, ...threads];
  const members = people.filter((p) => c.memberIds.includes(p.id));
  const count = c.members + (demo.joined.includes(c.id) && !c.custom ? 1 : 0);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim().length < 3) return;

    const authorName = demo.session?.name ?? "You";
    const newThread = {
      title: newTitle.trim(),
      author: authorName,
      replies: [],
    };

    setThreads((prev) => [newThread, ...prev]);

    if (demo.session?.id && !demo.session.demo) {
      await createCommunityThread(c.id, demo.session.id, newTitle.trim());
    }

    setNewTitle("");
    setShowNewThread(false);
    toast.success("Thread posted");
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
              <li key={t.title}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="flex w-full items-start justify-between gap-4 py-5 text-left"
                >
                  <span>
                    <span className="font-display text-xl font-semibold">{t.title}</span>
                    <span className="label-mono mt-1 block text-muted-foreground">
                      {t.author} · {t.replies.length} replies
                    </span>
                  </span>
                  <span className="label-mono text-signal">{open === i ? "−" : "+"}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <ul className="space-y-3 pb-6 pl-4">
                        {t.replies.map((r, j) => (
                          <li key={j} className="border-l border-border pl-4">
                            <p className="label-mono text-muted-foreground">{r.author}</p>
                            <p className="mt-1">{r.text}</p>
                          </li>
                        ))}
                        {!t.replies.length && (
                          <li className="text-sm text-muted-foreground">No replies yet.</li>
                        )}
                      </ul>
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
    </section>
  );
}
