/**
 * Rock-specific field tests for the identification confirmation step.
 * Answers adjust confidence in a meaningful way (expectsYes must be true/false — never null).
 */

/** @typedef {{ id: string, question: string, expectsYes: boolean, weight: number, why?: string }} FieldTest */

const BANK = {
  basalt: [
    {
      id: "dark_fine",
      question: "Is it dark gray/black with a fine (not chunky-crystal) look?",
      expectsYes: true,
      weight: 0.1,
      why: "Basalt is usually dark and fine-grained.",
    },
    {
      id: "heavy_dense",
      question: "Does it feel denser/heavier than a same-size piece of pumice or foam rock?",
      expectsYes: true,
      weight: 0.08,
      why: "Basalt is dense lava rock.",
    },
    {
      id: "magnet_no",
      question: "Does a fridge magnet stick strongly all over it?",
      expectsYes: false,
      weight: 0.07,
      why: "Most basalt is not strongly magnetic like magnetite.",
    },
  ],
  scoria: [
    {
      id: "holes",
      question: "Is it full of frozen bubble holes (looks spongy/rough)?",
      expectsYes: true,
      weight: 0.12,
      why: "Scoria is famous for bubbly holes.",
    },
    {
      id: "dark_color",
      question: "Is the rock dark red-brown to black (not pale white)?",
      expectsYes: true,
      weight: 0.08,
    },
    {
      id: "float_no",
      question: "Does it float in water like a boat?",
      expectsYes: false,
      weight: 0.09,
      why: "Scoria usually sinks; pumice can float.",
    },
  ],
  pumice: [
    {
      id: "float",
      question: "If a grown-up helps with a cup of water, does a dry piece float?",
      expectsYes: true,
      weight: 0.14,
      why: "Pumice is famous for floating.",
    },
    {
      id: "light",
      question: "Does it feel surprisingly light for its size?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "pale",
      question: "Is it pale gray, tan, or light-colored (not shiny black glass)?",
      expectsYes: true,
      weight: 0.07,
    },
  ],
  obsidian: [
    {
      id: "glass",
      question: "Does it look like dark glass with a shiny, smooth break?",
      expectsYes: true,
      weight: 0.13,
    },
    {
      id: "sharp",
      question: "Do edges look sharp/glassy (careful — don’t touch sharp edges!)?",
      expectsYes: true,
      weight: 0.08,
    },
    {
      id: "holes_no",
      question: "Is it full of big bubble holes like a sponge?",
      expectsYes: false,
      weight: 0.09,
      why: "Obsidian is solid glass, not scoria-bubbly.",
    },
  ],
  limestone: [
    {
      id: "pale",
      question: "Is it mostly light gray, cream, or white?",
      expectsYes: true,
      weight: 0.08,
    },
    {
      id: "fizz",
      question: "With a grown-up: does a tiny drop of vinegar fizz on a broken edge?",
      expectsYes: true,
      weight: 0.14,
      why: "Calcite in limestone often fizzes with weak acid.",
    },
    {
      id: "scratch_steel",
      question: "Can a steel nail (grown-up help) scratch it fairly easily?",
      expectsYes: true,
      weight: 0.07,
      why: "Limestone is softer than many volcanic rocks.",
    },
  ],
  sandstone: [
    {
      id: "gritty",
      question: "Does a broken surface feel gritty like sandpaper?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "layers",
      question: "Can you see sand-grainy layers or a sandy color (tan/brown/red)?",
      expectsYes: true,
      weight: 0.09,
    },
    {
      id: "glass_no",
      question: "Does it look like pure shiny glass?",
      expectsYes: false,
      weight: 0.08,
    },
  ],
  shale: [
    {
      id: "layers",
      question: "Does it split into flat, thin layers or chips?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "soft",
      question: "Does it feel softer than granite and flake a little?",
      expectsYes: true,
      weight: 0.09,
    },
    {
      id: "heavy_no",
      question: "Does it feel as heavy as a same-size metal object?",
      expectsYes: false,
      weight: 0.06,
    },
  ],
  conglomerate: [
    {
      id: "pebbles",
      question: "Can you see rounded pebbles stuck inside one rock?",
      expectsYes: true,
      weight: 0.14,
    },
    {
      id: "mixed",
      question: "Are the pebbles different colors/sizes cemented together?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  granite: [
    {
      id: "crystals",
      question: "Can you see speckles of different colors (pink/white/black/gray crystals)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "coarse",
      question: "Are the crystals big enough to see without a magnifying glass?",
      expectsYes: true,
      weight: 0.09,
    },
    {
      id: "bubbles_no",
      question: "Is it full of bubble holes like lava foam?",
      expectsYes: false,
      weight: 0.08,
    },
  ],
  gabbro: [
    {
      id: "dark_coarse",
      question: "Is it dark with fairly large crystals (not fine like basalt)?",
      expectsYes: true,
      weight: 0.11,
    },
    {
      id: "speckles",
      question: "Do you see a mix of dark minerals rather than one smooth color?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  rhyolite: [
    {
      id: "light_volcanic",
      question: "Is it light-colored (pink, tan, or pale gray) volcanic-looking rock?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "fine",
      question: "Is the grain mostly fine (not huge granite-like crystals)?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  andesite: [
    {
      id: "medium_gray",
      question: "Is it medium gray (not pure black, not pure white)?",
      expectsYes: true,
      weight: 0.09,
    },
    {
      id: "fineish",
      question: "Does it look finer than granite but maybe with a few small crystals?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  quartz: [
    {
      id: "hard",
      question: "With a grown-up: can it scratch a steel nail more easily than the nail scratches it?",
      expectsYes: true,
      weight: 0.1,
      why: "Quartz is quite hard.",
    },
    {
      id: "glassy",
      question: "Does it look glassy, milky, or crystal-clear in places?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "fizz_no",
      question: "Does vinegar fizz strongly on it?",
      expectsYes: false,
      weight: 0.09,
      why: "Quartz doesn’t fizz; calcite/limestone might.",
    },
  ],
  rose_quartz: [
    {
      id: "pink",
      question: "Is it pink or rosy (not purple amethyst)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "glassy_hard",
      question: "Does it look glassy/hard like quartz (often polished)?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "metallic_no",
      question: "Does it look metallic gold like pyrite?",
      expectsYes: false,
      weight: 0.1,
    },
  ],
  smoky_quartz: [
    {
      id: "brown_gray",
      question: "Is it transparent brown, gray, or smoky (not opaque dirt)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "glassy",
      question: "Does light pass through it at least a little?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  citrine: [
    {
      id: "yellow_orange",
      question: "Is it yellow, golden, or orange (often polished)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "glassy_quartz",
      question: "Does it look glassy like quartz rather than soft plastic?",
      expectsYes: true,
      weight: 0.1,
    },
  ],
  tigers_eye: [
    {
      id: "chatoyant",
      question: "Does it show a silky golden-brown ‘eye’ band that shifts in the light?",
      expectsYes: true,
      weight: 0.14,
    },
    {
      id: "polished",
      question: "Is it usually smooth/polished rather than rough lava rock?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  fluorite: [
    {
      id: "purple_green",
      question: "Is it purple, green, or banded glassy colors (often cubic)?",
      expectsYes: true,
      weight: 0.11,
    },
    {
      id: "softer_than_quartz",
      question: "Does it seem softer than a steel nail (grown-up help)?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  howlite: [
    {
      id: "white_veins",
      question: "Is it white/cream with gray webby veins (or dyed bright turquoise)?",
      expectsYes: true,
      weight: 0.12,
    },
  ],
  sodalite: [
    {
      id: "deep_blue",
      question: "Is it deep blue with white streaks?",
      expectsYes: true,
      weight: 0.13,
    },
  ],
  amethyst: [
    {
      id: "purple",
      question: "Is there clear purple or violet color in the crystal?",
      expectsYes: true,
      weight: 0.14,
    },
    {
      id: "crystal_points",
      question: "Does it show crystal points or glassy purple quartz texture?",
      expectsYes: true,
      weight: 0.1,
    },
  ],
  calcite: [
    {
      id: "fizz",
      question: "With a grown-up: does vinegar fizz on a fresh edge?",
      expectsYes: true,
      weight: 0.14,
    },
    {
      id: "soft",
      question: "Can a copper coin (grown-up help) scratch it?",
      expectsYes: true,
      weight: 0.09,
    },
    {
      id: "cleavage",
      question: "Does it break into blocky or rhombus-like shapes?",
      expectsYes: true,
      weight: 0.07,
    },
  ],
  feldspar: [
    {
      id: "blocky",
      question: "Do crystals look blocky with flat faces (not flaky sheets)?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "in_granite",
      question: "Is it a light-colored crystal sitting in a speckled rock like granite?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  mica: [
    {
      id: "flakes",
      question: "Does it peel into thin, shiny flexible flakes/sheets?",
      expectsYes: true,
      weight: 0.14,
    },
    {
      id: "shiny",
      question: "Does it sparkle like tiny mirrors?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  pyrite: [
    {
      id: "metallic",
      question: "Does it look metallic gold/brassy (not just yellow dirt)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "cubes",
      question: "Do you see cube-like shapes or square faces?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "scratch_gold_no",
      question: "Is it soft like real gold jewelry (easy to dent with a fingernail)?",
      expectsYes: false,
      weight: 0.09,
      why: "Pyrite is harder than gold — ‘fool’s gold’.",
    },
  ],
  hematite: [
    {
      id: "red_streak",
      question: "With a grown-up: on unglazed ceramic, does it leave a reddish-brown streak?",
      expectsYes: true,
      weight: 0.13,
    },
    {
      id: "heavy",
      question: "Does it feel unusually heavy for its size?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  magnetite: [
    {
      id: "magnet",
      question: "Does a fridge magnet stick firmly to it?",
      expectsYes: true,
      weight: 0.15,
      why: "Magnetite is strongly magnetic.",
    },
    {
      id: "dark_heavy",
      question: "Is it dark and feels dense/heavy?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  olivine: [
    {
      id: "green",
      question: "Do you see olive-green glassy grains or crystals?",
      expectsYes: true,
      weight: 0.13,
    },
    {
      id: "in_lava",
      question: "Are the green bits inside a darker volcanic rock?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  coral: [
    {
      id: "holes_pattern",
      question: "Do you see tiny tube holes or coral-like patterns?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "light",
      question: "Is it light-colored (white, cream, or pinkish)?",
      expectsYes: true,
      weight: 0.08,
    },
    {
      id: "living_no",
      question: "Is it still attached underwater as a living reef? (If yes, leave it!)",
      expectsYes: false,
      weight: 0.05,
    },
  ],
  beach_glass: [
    {
      id: "frosty",
      question: "Is it frosty/smooth like tumbled glass (not sharp new glass)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "manmade_color",
      question: "Is the color like bottle glass (green, brown, clear, blue)?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  chert: [
    {
      id: "hard_smooth",
      question: "Is it very hard and smooth with a waxy or dull look?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "sharp",
      question: "Does a broken edge look sharp (careful!)?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  gneiss: [
    {
      id: "bands",
      question: "Do you see striped bands of light and dark minerals?",
      expectsYes: true,
      weight: 0.13,
    },
    {
      id: "not_layers_mud",
      question: "Is it soft mud that peels like paper?",
      expectsYes: false,
      weight: 0.08,
    },
  ],
  schist: [
    {
      id: "sparkly_flaky",
      question: "Is it sparkly and flaky, almost like stacked shiny sheets?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "foliation",
      question: "Does it look layered/foliated rather than speckled granite?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  marble: [
    {
      id: "swirls",
      question: "Does it show soft swirls or crystalline sparkle like polished stone?",
      expectsYes: true,
      weight: 0.09,
    },
    {
      id: "fizz",
      question: "With a grown-up: does vinegar fizz on a powdered/scratched spot?",
      expectsYes: true,
      weight: 0.12,
    },
  ],
  slate: [
    {
      id: "flat_split",
      question: "Does it split into flat sheets like roof tiles?",
      expectsYes: true,
      weight: 0.13,
    },
    {
      id: "harder_than_shale",
      question: "Does it feel harder and denser than soft crumbling mudstone?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  agate: [
    {
      id: "bands",
      question: "Do you see colorful curved bands or rings?",
      expectsYes: true,
      weight: 0.14,
    },
    {
      id: "hard_silica",
      question: "Does it feel hard and waxy/glassy like hard silica?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  jasper: [
    {
      id: "opaque",
      question: "Is it colorful but opaque (you can’t see through it)?",
      expectsYes: true,
      weight: 0.11,
    },
    {
      id: "smooth_hard",
      question: "Is a broken edge hard and smooth (not sandy)?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  diamond: [
    {
      id: "extreme_hard",
      question: "With expert help only: does it scratch almost everything else easily?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "adamantine",
      question: "Does it have an extra-brilliant ‘super sparkle’ unlike normal glass?",
      expectsYes: true,
      weight: 0.1,
    },
    {
      id: "common_no",
      question: "Does it look like ordinary beach glass or plastic sparkle?",
      expectsYes: false,
      weight: 0.1,
    },
  ],
  ruby: [
    {
      id: "deep_red",
      question: "Is it a deep red transparent/translucent crystal (not painted plastic)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "hard",
      question: "Does it feel harder than a steel nail (grown-up test)?",
      expectsYes: true,
      weight: 0.09,
    },
  ],
  sapphire: [
    {
      id: "blue_hard",
      question: "Is it a hard blue (or other gem-colored) crystal, not soft dye?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "not_glass_soft",
      question: "Is it soft like plastic toy gem?",
      expectsYes: false,
      weight: 0.1,
    },
  ],
  emerald: [
    {
      id: "green_gem",
      question: "Is it a rich green gemmy crystal (not just green paint)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "hard",
      question: "Does it seem harder than a copper coin (grown-up help)?",
      expectsYes: true,
      weight: 0.08,
    },
  ],
  gold_nugget: [
    {
      id: "soft_metal",
      question: "Is it metallic yellow and soft enough that a fingernail can mark it (grown-up help)?",
      expectsYes: true,
      weight: 0.12,
    },
    {
      id: "not_pyrite_cubes",
      question: "Does it form perfect brass cubes like pyrite?",
      expectsYes: false,
      weight: 0.11,
    },
  ],
};

/** Tag-based fallbacks when rockId unknown */
const TAG_FALLBACKS = {
  volcanic: BANK.basalt,
  sedimentary: BANK.sandstone,
  mineral: BANK.quartz,
  gem: BANK.quartz,
  beach: BANK.beach_glass,
  biogenic: BANK.coral,
};

/**
 * Build definitive tests for a rock id (2–3 specific Y/N questions).
 * Always prefers curated bank over generic AI strings.
 */
export function testsForRock(rockId, rockName = "") {
  const id = String(rockId || "").toLowerCase().replace(/\s+/g, "_");
  let tests = BANK[id];
  if (!tests) {
    // try partial match
    const key = Object.keys(BANK).find((k) => id.includes(k) || k.includes(id));
    tests = key ? BANK[key] : null;
  }
  if (!tests) {
    const name = String(rockName || "").toLowerCase();
    if (name.includes("basalt")) tests = BANK.basalt;
    else if (name.includes("granite")) tests = BANK.granite;
    else if (name.includes("quartz")) tests = BANK.quartz;
    else tests = [
      {
        id: "natural_rock",
        question: "Does it look like a natural rock (not plastic, metal can, or wood)?",
        expectsYes: true,
        weight: 0.08,
      },
      {
        id: "solid",
        question: "Is it solid stone (not crumbly dirt or mud alone)?",
        expectsYes: true,
        weight: 0.07,
      },
    ];
  }
  return tests.slice(0, 3).map((t) => ({ ...t }));
}

/**
 * Normalize: always use rock-specific bank; optionally keep well-formed AI tests that have expectsYes.
 */
export function normalizeFieldTests(tests, rockId = "", rockName = "") {
  const curated = testsForRock(rockId, rockName);
  // If AI sent good structured tests with expectsYes boolean, merge unique questions
  const extras = [];
  if (Array.isArray(tests)) {
    for (const t of tests) {
      if (!t || typeof t === "string") continue;
      if (t.expectsYes !== true && t.expectsYes !== false) continue;
      const q = t.question || t.prompt;
      if (!q) continue;
      if (curated.some((c) => c.question === q)) continue;
      extras.push({
        id: t.id || `ai_${extras.length}`,
        question: q,
        expectsYes: !!t.expectsYes,
        weight: typeof t.weight === "number" ? Math.min(0.12, Math.max(0.05, t.weight)) : 0.07,
      });
    }
  }
  return [...curated, ...extras].slice(0, 3);
}

/**
 * Meaningful confidence update: matching answers raise conf, mismatches lower it.
 * Neutral/null expectsYes is not used in curated tests.
 */
export function adjustedConfidence(baseConfidence, tests, answers = {}) {
  let conf = Number(baseConfidence);
  if (Number.isNaN(conf)) conf = 0.4;

  let answered = 0;
  let matches = 0;
  let mismatches = 0;

  for (const t of tests || []) {
    const a = answers[t.id];
    if (a !== "yes" && a !== "no") continue;
    answered += 1;
    const yes = a === "yes";
    const w = typeof t.weight === "number" ? t.weight : 0.08;
    if (t.expectsYes === true || t.expectsYes === false) {
      if (yes === t.expectsYes) {
        matches += 1;
        conf += w;
      } else {
        mismatches += 1;
        conf -= w * 0.95;
      }
    }
  }

  // Completion bonus only if mostly matching
  if (answered >= 2 && matches > mismatches) conf += 0.03;
  if (answered >= 2 && mismatches > matches) conf -= 0.02;

  return Math.max(0.05, Math.min(0.97, conf));
}

export function testsComplete(tests, answers = {}) {
  if (!tests?.length) return false;
  return tests.every((t) => answers[t.id] === "yes" || answers[t.id] === "no");
}

export function formatAnswer(a) {
  if (a === "yes") return "Yes";
  if (a === "no") return "No";
  return "Not answered";
}
