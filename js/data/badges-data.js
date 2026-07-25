/**
 * Long adventure path — designed for weeks/months of collecting.
 * XP thresholds grow steadily so light testing stays in early levels.
 */
export const LEVELS = [
  { level: 1, title: "Pebble Scout", xp: 0, emoji: "🪨" },
  { level: 2, title: "Dusty Boots", xp: 80, emoji: "👢" },
  { level: 3, title: "Rock Ranger", xp: 200, emoji: "🧭" },
  { level: 4, title: "Trail Cub", xp: 360, emoji: "🐻" },
  { level: 5, title: "Stone Seeker", xp: 560, emoji: "🔍" },
  { level: 6, title: "Creek Walker", xp: 820, emoji: "🏞️" },
  { level: 7, title: "Ridge Runner", xp: 1140, emoji: "⛰️" },
  { level: 8, title: "Crystal Cadet", xp: 1520, emoji: "✨" },
  { level: 9, title: "Field Finder", xp: 1980, emoji: "🏕️" },
  { level: 10, title: "Treasure Hunter", xp: 2520, emoji: "💎" },
  { level: 11, title: "Vein Tracker", xp: 3160, emoji: "🗺️" },
  { level: 12, title: "Geode Guard", xp: 3900, emoji: "🛡️" },
  { level: 13, title: "Lava Learner", xp: 4740, emoji: "🌋" },
  { level: 14, title: "Mineral Mate", xp: 5700, emoji: "🤝" },
  { level: 15, title: "Quarry Quest", xp: 6780, emoji: "⛏️" },
  { level: 16, title: "Fossil Friend", xp: 8000, emoji: "🦴" },
  { level: 17, title: "Spark Scout", xp: 9360, emoji: "⚡" },
  { level: 18, title: "Bedrock Buddy", xp: 10880, emoji: "🧱" },
  { level: 19, title: "Crystal Captain", xp: 12560, emoji: "⚓" },
  { level: 20, title: "Ore Odyssey", xp: 14400, emoji: "🚀" },
  { level: 21, title: "Gem Guardian", xp: 16420, emoji: "🏰" },
  { level: 22, title: "Strata Star", xp: 18640, emoji: "🌟" },
  { level: 23, title: "Peak Prospector", xp: 21080, emoji: "🏔️" },
  { level: 24, title: "Deep Delver", xp: 23760, emoji: "🕳️" },
  { level: 25, title: "Crystal Master", xp: 26680, emoji: "👑" },
  { level: 26, title: "Island Explorer", xp: 29860, emoji: "🏝️" },
  { level: 27, title: "World Wanderer", xp: 33320, emoji: "🌍" },
  { level: 28, title: "Legend of Layers", xp: 37080, emoji: "📜" },
  { level: 29, title: "Mythic Miner", xp: 41160, emoji: "🦄" },
  { level: 30, title: "Eternal Earthkeeper", xp: 45580, emoji: "🌌" },
];

export const BADGES = [
  {
    id: "first_find",
    name: "First Find",
    emoji: "✨",
    description: "Identify your very first rock!",
    path: "main",
    check: (s) => s.stats.identified >= 1,
  },
  {
    id: "rock_ranger",
    name: "Rock Ranger",
    emoji: "🧭",
    description: "Collect 3 different rock types.",
    path: "main",
    check: (s) => s.stats.collectedTypes >= 3,
  },
  {
    id: "stone_seeker",
    name: "Stone Seeker",
    emoji: "🔍",
    description: "See 8 different rock types.",
    path: "main",
    check: (s) => s.stats.seenTypes >= 8,
  },
  {
    id: "treasure_hunter",
    name: "Treasure Hunter",
    emoji: "💎",
    description: "Collect 12 rocks (any finds).",
    path: "main",
    check: (s) => s.stats.collectedCount >= 12,
  },
  {
    id: "crystal_master",
    name: "Crystal Master",
    emoji: "👑",
    description: "Reach Crystal Master rank (level 25).",
    path: "main",
    check: (s) => s.level >= 25,
  },
  {
    id: "earthkeeper",
    name: "Earthkeeper",
    emoji: "🌌",
    description: "Reach the final path rank — Eternal Earthkeeper!",
    path: "main",
    check: (s) => s.level >= 30,
  },
  {
    id: "beachcomber",
    name: "Beachcomber",
    emoji: "🏖️",
    description: "Collect a beach-type find (coral, beach glass, basalt, or olivine).",
    path: "side",
    check: (s) =>
      s.collectedIds.some((id) =>
        ["coral", "beach_glass", "basalt", "olivine"].includes(id)
      ),
  },
  {
    id: "first_rare",
    name: "First Rare",
    emoji: "🟣",
    description: "Collect a Rare rock or mineral.",
    path: "side",
    check: (s) => s.stats.rareCollected >= 1,
  },
  {
    id: "ultra_legend",
    name: "Ultra Legend",
    emoji: "🌟",
    description: "Collect an Ultra Rare find (super lucky!).",
    path: "side",
    check: (s) => s.stats.ultraCollected >= 1,
  },
  {
    id: "local_legend",
    name: "Local Legend",
    emoji: "🌺",
    description: "Collect 3 Hawaii-friendly volcanic types (basalt, scoria, olivine, pumice…).",
    path: "side",
    check: (s) => {
      const hi = ["basalt", "scoria", "pumice", "olivine", "obsidian"];
      return s.collectedIds.filter((id) => hi.includes(id)).length >= 3;
    },
  },
  {
    id: "trail_blazer",
    name: "Trail Blazer",
    emoji: "🥾",
    description: "Check in at a suggested adventure spot (go there for real!).",
    path: "side",
    check: (s) => s.stats.checkInCount >= 1,
  },
  {
    id: "pathfinder",
    name: "Pathfinder",
    emoji: "🗺️",
    description: "Check in at 3 different adventure spots.",
    path: "side",
    check: (s) => s.stats.checkInCount >= 3,
  },
  {
    id: "outdoor_finder",
    name: "Outdoor Finder",
    emoji: "☀️",
    description: "Save a rock marked as found outside with a location.",
    path: "side",
    check: (s) => s.stats.outdoorFinds >= 1,
  },
  {
    id: "memory_maker",
    name: "Memory Maker",
    emoji: "📸",
    description: "Add 3 adventure photos in Explore.",
    path: "side",
    check: (s) => s.stats.adventurePhotos >= 3,
  },
  {
    id: "place_photographer",
    name: "Place Photographer",
    emoji: "🎯",
    description: "Complete a location photo challenge (snap the place highlight).",
    path: "side",
    check: (s) => (s.stats.photoChallenges || 0) >= 1,
  },
  {
    id: "island_spotter",
    name: "Island Spotter",
    emoji: "🗺️",
    description: "Complete photo challenges at 3 different adventure spots.",
    path: "side",
    check: (s) => (s.stats.photoChallenges || 0) >= 3,
  },
  {
    id: "note_taker",
    name: "Field Journal",
    emoji: "📓",
    description: "Add a nickname or note to a collected rock.",
    path: "side",
    check: (s) => s.flags.hasNotes === true,
  },
  {
    id: "showcase_star",
    name: "Showcase Star",
    emoji: "⭐",
    description: "Mark 3 favorites for your showcase.",
    path: "side",
    check: (s) => s.stats.favorites >= 3,
  },
  {
    id: "sharp_eye",
    name: "Sharp Eye",
    emoji: "👀",
    description: "Identify 10 rocks (even if you don’t keep them all).",
    path: "side",
    check: (s) => s.stats.identified >= 10,
  },
  {
    id: "field_scientist",
    name: "Field Scientist",
    emoji: "🔬",
    description: "Complete field tests on 3 saved rocks.",
    path: "side",
    check: (s) => s.stats.fieldTestedFinds >= 3,
  },
];

export function levelFromXp(xp) {
  let current = LEVELS[0];
  for (const L of LEVELS) {
    if (xp >= L.xp) current = L;
  }
  const next = LEVELS.find((L) => L.xp > xp) || null;
  const prevXp = current.xp;
  const nextXp = next ? next.xp : current.xp;
  const progress = next ? Math.min(1, (xp - prevXp) / (nextXp - prevXp || 1)) : 1;
  return { current, next, progress };
}

/** Slower XP — real collecting over weeks/months */
export const XP_REWARDS = {
  identify: 4,
  identifyNewType: 3,
  collectNew: 10,
  collectDupe: 2,
  firstRare: 12,
  firstUltra: 20,
  outdoorBonus: 6,
  checkIn: 15,
  checkInNewSpot: 8,
  fieldTestRound: 3,
  adventurePhoto: 5,
  /** Bonus for snapping the place’s specific highlight while on-site */
  photoChallenge: 12,
  badge: 12,
};
