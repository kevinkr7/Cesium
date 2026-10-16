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
  photo?: string;
  bio: string;
  interests: string[];
  why: string;
  featured?: boolean;
  recent?: boolean;
};

export const people: Person[] = [
  {
    id: "mira",
    name: "Mira Raman",
    handle: "@halfexposed",
    city: "Bengaluru",
    photo: mira,
    featured: true,
    bio: "Shoots expired film, writes shaders, keeps a notebook of sky colours.",
    interests: ["Creative coding", "Film photography", "Astronomy", "Ambient music"],
    why: "You both turn quiet late-night hours into small, strange projects.",
    recent: true,
  },
  {
    id: "eli",
    name: "Eli Okafor",
    handle: "@patchbay",
    city: "Rotterdam",
    photo: eli,
    featured: true,
    bio: "Modular synths on the floor, indie games in progress, too many cables.",
    interests: ["Creative coding", "Indie games", "Astronomy", "Synthesizers"],
    why: "He builds instruments the way you build tools — slowly, for joy.",
  },
  {
    id: "ines",
    name: "Inês Carvalho",
    handle: "@lowmagnitude",
    city: "Lisbon",
    photo: ines,
    bio: "Retired cartographer. Rooftop telescope. Asks impossible questions at dinner.",
    interests: ["Astronomy", "Weather maps", "Urban walking", "Translated fiction"],
    why: "An uncommon overlap: maps of land, maps of sky, maps of feeling.",
    recent: true,
  },
  {
    id: "kai",
    name: "Kai Nakamura",
    handle: "@b-side",
    city: "Osaka",
    photo: kai,
    bio: "Record shop regular. Reads translated fiction between crates.",
    interests: ["Translated fiction", "Ambient music", "Indie cinema", "Field recording"],
    why: "He listens to rooms the way you look at films.",
  },
  {
    id: "noor",
    name: "Noor Haddad",
    handle: "@spore.print",
    city: "Amman",
    bio: "Forages mushrooms, prints zines about them, argues about fonts.",
    interests: ["Mycology", "Zine making", "Typography", "Letterpress"],
    why: "Different subjects, same instinct: archive the overlooked.",
  },
  {
    id: "theo",
    name: "Theo Lindqvist",
    handle: "@frame39",
    city: "Malmö",
    bio: "Speedruns puzzle games, designs his own, loses to his niece.",
    interests: ["Speedrunning", "Puzzle design", "Indie games", "Retro computing"],
    why: "You'd both rather understand a system than simply beat it.",
    recent: true,
  },
  {
    id: "ade",
    name: "Adaeze Bello",
    handle: "@concrete.poem",
    city: "Lagos",
    bio: "Architect by day, brutalism tour guide by weekend.",
    interests: [
      "Brutalist architecture",
      "Urban walking",
      "Film photography",
      "Abandoned railways",
    ],
    why: "You both walk cities slowly and photograph what's about to vanish.",
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
    memberIds: ["mira", "eli", "theo"],
    threads: [
      {
        title: "Built a clock that only tells time in moon phases",
        author: "Mira Raman",
        replies: [
          { author: "Eli Okafor", text: "this is useless and I need one immediately" },
          { author: "Theo Lindqvist", text: "does it handle eclipses or is that v2" },
        ],
      },
      {
        title: "What's the oldest unfinished project you still think about?",
        author: "Theo Lindqvist",
        replies: [
          { author: "Mira Raman", text: "A typeface made only from bus stop signs. Since 2019." },
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
    memberIds: ["eli", "kai"],
    threads: [
      {
        title: "Generative ambient from my plant's moisture sensor",
        author: "Eli Okafor",
        replies: [{ author: "Kai Nakamura", text: "the drought section is genuinely haunting" }],
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
    memberIds: ["ines", "mira"],
    threads: [
      {
        title: "If you could rename one constellation, which and why?",
        author: "Inês Carvalho",
        replies: [{ author: "Mira Raman", text: "Orion → 'Man Looking For His Keys'" }],
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
    memberIds: ["kai", "ade"],
    threads: [
      {
        title: "Which movie deserves a completely different ending?",
        author: "Kai Nakamura",
        replies: [
          {
            author: "Adaeze Bello",
            text: "Any film where the building survives but the people don't learn anything.",
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
    memberIds: ["noor"],
    threads: [{ title: "Spore prints as risograph textures?", author: "Noor Haddad", replies: [] }],
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
