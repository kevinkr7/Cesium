import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { communities, type Community } from "@/lib/data";
import { setDemo, useDemo } from "@/lib/store";
import { JoinButton } from "@/components/JoinButton";
import { fetchCommunitiesList, createNewCommunity } from "@/services/communities";

import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/communities/")({
  head: () => ({
    meta: [
      { title: "Communities — Cesium" },
      { name: "description", content: "Small, unconventional communities for niche obsessions." },
      { property: "og:title", content: "Communities — Cesium" },
      { property: "og:description", content: "Somewhere between niche and necessary." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Directory />
    </RequireAuth>
  ),
});

function Directory() {
  const demo = useDemo();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dbCommunities, setDbCommunities] = useState<Community[]>(communities);

  useEffect(() => {
    fetchCommunitiesList().then(setDbCommunities);
  }, []);

  const all: Community[] = [...dbCommunities, ...demo.custom];
  const topics = [...new Set(all.flatMap((c) => c.topics))];
  const list = all.filter(
    (c) =>
      (!q || `${c.name} ${c.line}`.toLowerCase().includes(q.toLowerCase())) &&
      (!topic || c.topics.includes(topic)),
  );
  const featured = list.slice(0, 2),
    rest = list.slice(2);

  return (
    <section className="gutter min-h-[100svh] pb-24 pt-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label-mono text-muted-foreground">Communities / 003</p>
          <h1 className="display mt-4 max-w-4xl text-[clamp(44px,6.5vw,104px)]">
            Small rooms. Loud curiosity.
          </h1>
        </div>
        <button onClick={() => setCreating(true)} className="btn-signal">
          <span>Start a community</span>
          <Plus size={18} />
        </button>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-4 border-y border-border py-4">
        <label className="flex min-w-[240px] flex-1 items-center gap-3">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search communities"
            aria-label="Search communities"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, 8).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(topic === t ? null : t)}
              data-on={topic === t}
              className="chip !text-xs"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 && (
        <p className="display mt-16 text-3xl text-muted-foreground">
          Nothing here yet — maybe you should start it.
        </p>
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {featured.map((c, i) => (
          <Link
            key={c.id}
            to="/communities/$id"
            params={{ id: c.id }}
            className="group relative flex min-h-[340px] flex-col justify-between border border-border p-8 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex justify-between">
              <span className="label-mono text-signal">
                Featured · {String(i + 1).padStart(3, "0")}
              </span>
              <ArrowUpRight className="text-muted-foreground transition-colors group-hover:text-signal" />
            </div>
            <div>
              <p className="display text-[clamp(36px,4.5vw,72px)]">{c.name}</p>
              <p className="mt-3 text-muted-foreground">{c.line}</p>
              <div className="mt-6 flex items-center justify-between">
                <span className="label-mono text-muted-foreground">{c.members} members</span>
                <JoinButton id={c.id} />
              </div>
            </div>
          </Link>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {rest.map((c, i) => (
          <li key={c.id}>
            <Link
              to="/communities/$id"
              params={{ id: c.id }}
              className="group grid grid-cols-12 items-center gap-4 py-6 transition-colors hover:bg-surface/40"
            >
              <span className="label-mono col-span-1 text-muted-foreground">
                {String(i + 3).padStart(3, "0")}
              </span>
              <span className="col-span-11 font-display text-2xl font-bold group-hover:text-signal md:col-span-4">
                {c.name}
                {c.custom && <span className="label-mono ml-2 text-muted-foreground">yours</span>}
              </span>
              <span className="col-span-12 text-muted-foreground md:col-span-4">{c.line}</span>
              <span className="label-mono col-span-6 text-muted-foreground md:col-span-1">
                {c.members}
              </span>
              <span className="col-span-6 flex justify-end md:col-span-2">
                <JoinButton id={c.id} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {creating && (
          <CreateForm
            onClose={() => setCreating(false)}
            onCreated={(newComm) => {
              setDbCommunities((prev) => [newComm, ...prev]);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function CreateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Community) => void;
}) {
  const demo = useDemo();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<{ name?: string; desc?: string }>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: { name?: string; desc?: string } = {};
    if (name.trim().length < 3) er.name = "At least 3 characters";
    if (name.length > 40) er.name = "Keep it under 40";
    if (desc.trim().length < 10) er.desc = "Tell people a little more (10+ characters)";
    setErr(er);
    if (Object.keys(er).length) return;

    const res = await createNewCommunity({
      name: name.trim(),
      description: desc.trim(),
      userId: demo.session?.id,
    });

    if (res.community) {
      setDemo((s) => ({
        custom: [...s.custom, res.community!],
        joined: [...s.joined, res.community!.id],
      }));
      onCreated(res.community);
      toast.success("Community created successfully");
      onClose();
    } else {
      toast.error(res.error ?? "Failed to create community");
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-5 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-label="Start a community"
        onSubmit={submit}
        noValidate
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        className="w-full max-w-lg space-y-6 border border-border bg-background p-8"
      >
        <div className="flex justify-between">
          <p className="label-mono text-signal">New community</p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="field" data-invalid={!!err.name}>
          <input
            id="cname"
            placeholder=" "
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label htmlFor="cname">Name</label>
          <span className="line" />
          {err.name && <p className="label-mono mt-2 text-destructive">↳ {err.name}</p>}
        </div>
        <div>
          <label htmlFor="cdesc" className="label-mono text-muted-foreground">
            What's the room about?
          </label>
          <textarea
            id="cdesc"
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mt-2 w-full border border-input bg-transparent p-3 text-sm outline-none focus:border-signal"
          />
          {err.desc && <p className="label-mono mt-1 text-destructive">↳ {err.desc}</p>}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" className="btn-signal">
            <span>Create room</span>
            <Plus size={16} />
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
