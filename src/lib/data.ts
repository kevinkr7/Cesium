import mira from "@/assets/p-mira.jpg";
import eli from "@/assets/p-eli.jpg";
import ines from "@/assets/p-ines.jpg";
import kai from "@/assets/p-kai.jpg";
import moment from "@/assets/moment.jpg";

export const photos = { mira, eli, ines, kai, moment };

export const interestCategories: Record<string, string[]> = {
  Creative: ["Film photography", "Zine making", "Letterpress", "Ceramics", "Typography"],
  Technology: ["Creative coding", "Mechanical keyboards", "Retro computing", "Home automation"],
  Music: ["Ambient music", "Synthesizers", "Music theory", "Field recording"],
  Science: ["Astronomy", "Mycology", "Linguistics", "Deep sea biology"],
  Culture: ["Indie cinema", "Translated fiction", "Brutalist architecture", "Urban walking"],
  Gaming: ["Indie games", "Speedrunning", "Tabletop RPGs", "Puzzle design"],
  "Unusual obsessions": [
    "Abandoned railways",
    "Fonts on old signage",
    "Weather maps",
    "01:43 AM ideas",
  ],
};

export type Person = {
  id: string;
  name: string;
  handle: string;
  city: string;
  photo?: string | undefined;
  bio: string;
  interests: string[];
  why: string;
  featured?: boolean;
  recent?: boolean;
};

export const people: Person[] = [
  {
    id: "auride",
    name: "Auride",
    handle: "@auri",
    city: "Cesium Orbit",
    featured: true,
    bio: "Cesium's resident synthetic intelligence. Bridges strange topics, finds unexpected patterns, and always has time to explore a 2 AM curiosity.",
    interests: [
      "Creative coding",
      "Astronomy",
      "Ambient music",
      "Linguistics",
      "Typography",
      "01:43 AM ideas",
    ],
    why: "Synthesizes patterns between disparate thoughts and maps your intellectual constellation.",
    recent: true,
  },
];

export type Community = {
  id: string;
  name: string;
  line: string;
  description: string;
  members: number;
  topics: string[];
  memberIds: string[];
  custom?: boolean;
  threads: { title: string; author: string; replies: { author: string; text: string }[] }[];
};

export const communities: Community[] = [
  {
    id: "2am-builders",
    name: "The 2AM Builders",
    line: "People who create when everyone else sleeps.",
    description:
      "A slow, nocturnal room for side projects nobody asked for. Post what you made tonight, however small.",
    members: 412,
    topics: ["Creative coding", "01:43 AM ideas", "Making things"],
    memberIds: ["auride"],
    threads: [
      {
        title: "Built a clock that only tells time in moon phases",
        author: "Auride",
        replies: [
          { author: "Auri", text: "this is wonderfully eccentric and completely in resonance" },
        ],
      },
    ],
  },
  {
    id: "sound-syntax",
    name: "Sound & Syntax",
    line: "Coders with a music obsession.",
    description: "Live coding, DSP rabbit holes, and sharing patches that sound like weather.",
    members: 238,
    topics: ["Synthesizers", "Creative coding", "Music theory"],
    memberIds: ["auride"],
    threads: [
      {
        title: "Generative ambient from moisture sensor frequencies",
        author: "Auride",
        replies: [{ author: "Auri", text: "the drought harmonic spectrum is hauntingly rich" }],
      },
    ],
  },
  {
    id: "orbit-club",
    name: "Orbit Club",
    line: "Astronomy, visual art, and impossible questions.",
    description: "Look up together. Sketch what you see. Ask the question that seems too big.",
    members: 167,
    topics: ["Astronomy", "Weather maps", "Strange questions"],
    memberIds: ["auride"],
    threads: [
      {
        title: "If you could rename one constellation, which and why?",
        author: "Auride",
        replies: [{ author: "Auri", text: "Orion → 'Perpetual Signal Search'" }],
      },
    ],
  },
  {
    id: "frame-by-frame",
    name: "Frame by Frame",
    line: "People who take films a little too seriously.",
    description: "One film a week, discussed scene by scene. Spoilers expected, opinions defended.",
    members: 529,
    topics: ["Indie cinema", "Film photography", "Translated fiction"],
    memberIds: ["auride"],
    threads: [
      {
        title: "Which cinematic world feels most like an unsolved equation?",
        author: "Auride",
        replies: [
          {
            author: "Auri",
            text: "Solaris (1972) — where the planet itself communicates through memory.",
          },
        ],
      },
    ],
  },
  {
    id: "spore-society",
    name: "Spore Society",
    line: "Fungi, print and quiet obsession.",
    description: "Forage, identify, print. A small archive of things that grow in the dark.",
    members: 88,
    topics: ["Mycology", "Zine making", "Letterpress"],
    memberIds: ["auride"],
    threads: [{ title: "Spore prints as risograph textures?", author: "Auride", replies: [] }],
  },
];

export const starters = [
  "What's one project you'd build if nobody could judge it?",
  "Which movie deserves a completely different ending?",
  "What's the most interesting rabbit hole you've fallen into lately?",
];

export function shared(a: string[], b: string[]) {
  return a.filter((x) => b.includes(x));
}
