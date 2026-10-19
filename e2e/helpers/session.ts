import type { Page } from "@playwright/test";

export interface SeedStateOptions {
  userId?: string;
  name?: string;
  email?: string;
  handle?: string;
  onboarded?: boolean;
  interests?: string[];
  niche?: string[];
  connections?: Record<string, "pending" | "connected">;
  joined?: string[];
  blockedUsers?: string[];
  messages?: Record<
    string,
    Array<{
      id: string;
      from: "me" | "them";
      text: string;
      at: number;
      status?: "sending" | "sent" | "error";
    }>
  >;
}

export const DEFAULT_AUTH_USER = {
  userId: "demo-user-e2e",
  name: "Alex Rivera",
  email: "alex@cesium.orbit",
  handle: "alex_orbit",
};

export async function seedSession(page: Page, options: SeedStateOptions = {}) {
  const userId = options.userId ?? DEFAULT_AUTH_USER.userId;
  const name = options.name ?? DEFAULT_AUTH_USER.name;
  const email = options.email ?? DEFAULT_AUTH_USER.email;
  const handle = options.handle ?? DEFAULT_AUTH_USER.handle;
  const onboarded = options.onboarded ?? true;

  const state = {
    session: {
      id: userId,
      name,
      email,
      demo: true,
    },
    profile: {
      id: userId,
      handle,
      display_name: name,
      city: "San Francisco",
      bio: "Exploring algorithmic composition and vintage synths.",
      topics: "Synthesizers, generative art, astronomy",
      conversation_style: ["Deep dives"],
      onboarding_completed: onboarded,
      avatar_path: null,
      discoverable: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    city: "San Francisco",
    interests: options.interests ?? [
      "Creative coding",
      "Astronomy",
      "Ambient music",
      "Film photography",
      "Indie cinema",
    ],
    niche: options.niche ?? ["Modular synthesizer patches"],
    bio: "Exploring algorithmic composition and vintage synths.",
    styles: ["Deep dives"],
    topics: "Synthesizers, generative art, astronomy",
    onboarded,
    connections: options.connections ?? { mira: "connected" },
    joined: options.joined ?? ["2am-builders"],
    custom: [],
    blockedUsers: options.blockedUsers ?? [],
    messages: options.messages ?? {
      mira: [
        {
          id: "m1",
          from: "them",
          text: "Your note about bus-stop typography made my week.",
          at: Date.now() - 3600e3 * 5,
          status: "sent",
        },
        {
          id: "m2",
          from: "me",
          text: "Ha — I have a folder of 400 photos of them.",
          at: Date.now() - 3600e3 * 4.8,
          status: "sent",
        },
      ],
    },
  };

  await page.addInitScript((val) => {
    window.localStorage.setItem("cesium-demo-v1", JSON.stringify(val));
    window.sessionStorage.setItem("cs-intro", "1");
  }, state);
}

export async function seedUnauthenticated(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("cesium-demo-v1");
    window.sessionStorage.setItem("cs-intro", "1");
  });
}
