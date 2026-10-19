import { useSyncExternalStore } from "react";
import type { Community } from "./data";
import { getSupabase } from "./supabase/client";
import type { Profile } from "@/services/profiles";

export type Msg = {
  id: string;
  from: "me" | "them";
  text: string;
  at: number;
  status?: "sending" | "sent" | "error" | undefined;
};
export type DemoState = {
  session: {
    id?: string | undefined;
    name: string;
    email: string;
    demo?: boolean | undefined;
  } | null;
  profile?: Profile | null | undefined;
  city?: string | undefined;
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
  blockedUsers: string[];
  unreadNotificationCount: number;
};

const KEY = "cesium-demo-v1";
const defaults: DemoState = {
  session: null,
  profile: null,
  city: "Worldwide",
  interests: ["Creative coding", "Astronomy", "Ambient music", "Film photography", "Indie cinema"],
  niche: ["Fonts on old signage"],
  bio: "Collects small strange ideas and occasionally finishes one.",
  styles: ["Slow & thoughtful"],
  topics: "Space, sound, unfinished projects",
  onboarded: false,
  connections: { mira: "connected" },
  joined: ["2am-builders"],
  custom: [],
  blockedUsers: [],
  unreadNotificationCount: 0,
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

import { fetchProfile } from "@/services/profiles";
import { fetchUserInterests } from "@/services/interests";

let state: DemoState = defaults;
let loaded = false;
const listeners = new Set<() => void>();

async function syncUserSession(
  userId: string,
  defaultName: string,
  email: string,
  avatarUrl?: string,
) {
  let profile = null;
  let userInterests = null;
  try {
    profile = await fetchProfile(userId);
    userInterests = await fetchUserInterests(userId);
  } catch (err) {
    void err;
  }

  setDemo((prev) => ({
    session: {
      id: userId,
      name: profile?.display_name || defaultName,
      email: email,
      demo: false,
    },
    profile: profile
      ? { ...profile, avatar_path: profile.avatar_path || avatarUrl || null }
      : profile,
    city: profile?.city ?? prev.city ?? "Worldwide",
    onboarded: profile ? profile.onboarding_completed : prev.onboarded,
    bio: profile?.bio ?? prev.bio,
    topics: profile?.topics ?? prev.topics,
    styles:
      profile?.conversation_style && profile.conversation_style.length > 0
        ? profile.conversation_style
        : prev.styles,
    interests:
      userInterests && userInterests.standard.length > 0 ? userInterests.standard : prev.interests,
    niche: userInterests && userInterests.niche.length > 0 ? userInterests.niche : prev.niche,
  }));
}

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
    const extractMeta = (u: { email?: string; user_metadata?: Record<string, unknown> }) => {
      const meta = u.user_metadata || {};
      const name =
        (meta["full_name"] as string) ||
        (meta["name"] as string) ||
        (meta["display_name"] as string) ||
        (u.email?.split("@")[0] ?? "Visitor");
      const avatar = (meta["avatar_url"] as string) || (meta["picture"] as string) || undefined;
      return { name, avatar };
    };

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        const { name, avatar } = extractMeta(u);
        syncUserSession(u.id, name, u.email ?? "", avatar);
      }
    });

    sb.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const u = session.user;
        const { name, avatar } = extractMeta(u);
        syncUserSession(u.id, name, u.email ?? "", avatar);
      } else if (event === "SIGNED_OUT") {
        setDemo({ session: null, onboarded: false });
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
  state = { ...defaults, session: null, onboarded: false };
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    void err;
  }
  listeners.forEach((l) => l());
}

export function getDemoState(): DemoState {
  load();
  return state;
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

if (typeof window !== "undefined") {
  load();
}
