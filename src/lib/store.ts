import { useSyncExternalStore } from "react";
import type { Community } from "./data";
import { getSupabase } from "./supabase/client";

export type Msg = { id: string; from: "me" | "them"; text: string; at: number };
export type DemoState = {
  session: { id?: string; name: string; email: string; demo?: boolean } | null;
  interests: string[];
  niche: string[];
  bio: string;
  styles: string[];
  topics: string;
  onboarded: boolean;
  connections: Record<string, "pending" | "connected">;
  joined: string[];
  custom: Community[];
  messages: Record<string, Msg[]>;
};

const KEY = "cesium-demo-v1";
const defaults: DemoState = {
  session: null,
  interests: ["Creative coding", "Astronomy", "Ambient music", "Film photography", "Indie cinema"],
  niche: ["Fonts on old signage"],
  bio: "Collects small strange ideas and occasionally finishes one.",
  styles: ["Slow & thoughtful"],
  topics: "Space, sound, unfinished projects",
  onboarded: false,
  connections: { mira: "connected" },
  joined: ["2am-builders"],
  custom: [],
  messages: {
    mira: [
      {
        id: "m1",
        from: "them",
        text: "Your note about bus-stop typography made my week.",
        at: Date.now() - 3600e3 * 5,
      },
      {
        id: "m2",
        from: "me",
        text: "Ha — I have a folder of 400 photos of them.",
        at: Date.now() - 3600e3 * 4.8,
      },
      {
        id: "m3",
        from: "them",
        text: "Okay we need to make a zine.",
        at: Date.now() - 3600e3 * 4.7,
      },
    ],
  },
};

let state: DemoState = defaults;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...defaults, ...JSON.parse(raw) };
  } catch (err) {
    void err;
  }

  // Sync with Supabase Auth session if configured
  const sb = getSupabase();
  if (sb) {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setDemo({
          session: {
            id: session.user.id,
            name:
              (session.user.user_metadata?.display_name as string) ||
              (session.user.email?.split("@")[0] ?? "Visitor"),
            email: session.user.email ?? "",
            demo: false,
          },
        });
      }
    });

    sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setDemo({
          session: {
            id: session.user.id,
            name:
              (session.user.user_metadata?.display_name as string) ||
              (session.user.email?.split("@")[0] ?? "Visitor"),
            email: session.user.email ?? "",
            demo: false,
          },
        });
      } else {
        setDemo({ session: null });
      }
    });
  }
}

export function setDemo(patch: Partial<DemoState> | ((s: DemoState) => Partial<DemoState>)) {
  load();
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    void err;
  }
  listeners.forEach((l) => l());
}

export function resetDemo() {
  state = defaults;
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    void err;
  }
  listeners.forEach((l) => l());
}

export function useDemo() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      load();
      return state;
    },
    () => defaults,
  );
}
