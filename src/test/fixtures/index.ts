import type { AuthUser } from "@/services/auth";
import type { DiscoveryCandidate } from "@/services/discovery";
import type { Community } from "@/lib/data";

export const FIXTURE_USERS: Record<string, AuthUser> = {
  alex: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "alex@cesium.social",
    displayName: "Alex Rivera",
    handle: "@arivera",
  },
  mira: {
    id: "00000000-0000-0000-0000-000000000002",
    email: "mira@cesium.social",
    displayName: "Mira Vance",
    handle: "@miravance",
  },
  kai: {
    id: "00000000-0000-0000-0000-000000000003",
    email: "kai@cesium.social",
    displayName: "Kai Chen",
    handle: "@kaichen",
  },
};

export const FIXTURE_INTERESTS = {
  primary: ["Creative coding", "Astronomy", "Ambient music", "Film photography"],
  niche: ["Fonts on old signage", "01:43 AM ideas"],
  uncommon: ["Tabletop RPGs", "Deep sea biology"],
};

export const FIXTURE_DISCOVERY_CANDIDATES: DiscoveryCandidate[] = [
  {
    id: "mira",
    name: "Mira Vance",
    handle: "@miravance",
    city: "Brooklyn, NY",
    bio: "Type designer, ghost sign collector, and late night synth experimenter.",
    interests: ["Typography", "Fonts on old signage", "Synthesizers", "Zine making"],
    sharedInterests: ["Fonts on old signage", "Synthesizers"],
    matchScore: 84,
    why: "You share common ground in Fonts on old signage and Synthesizers.",
    connectionStatus: "connected",
    recent: true,
  },
  {
    id: "kai",
    name: "Kai Chen",
    handle: "@kaichen",
    city: "Berlin",
    bio: "Generative graphics, shader toys, modular gear, and quiet tea rooms.",
    interests: ["Creative coding", "Retro computing", "Ambient music", "Field recording"],
    sharedInterests: ["Creative coding", "Ambient music"],
    matchScore: 78,
    why: "You share common ground in Creative coding and Ambient music.",
    connectionStatus: "none",
  },
];

export const FIXTURE_COMMUNITY: Community = {
  id: "fixture-builders",
  name: "2 AM Builders",
  line: "Quiet projects shipped before sunrise.",
  description: "A sanctuary for creators working in the silent hours of night.",
  members: 142,
  topics: ["Creative coding", "01:43 AM ideas", "Retro computing"],
  memberIds: ["00000000-0000-0000-0000-000000000001"],
  custom: false,
  threads: [
    {
      title: "What are you tinkering on tonight?",
      author: "Mira Vance",
      replies: [
        {
          author: "Kai Chen",
          text: "Writing a raymarching shader that looks like liquid quartz.",
        },
      ],
    },
  ],
};
