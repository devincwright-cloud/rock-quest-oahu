/** Seed catalog — rock/mineral types kids may find */
export const ROCK_CATALOG = [
  { id: "basalt", name: "Basalt", rarity: "common", tags: ["volcanic", "hawaii"], hint: "Dark lava rock — super common on Oahu!" },
  { id: "scoria", name: "Scoria", rarity: "common", tags: ["volcanic", "hawaii"], hint: "Bubbly dark rock full of holes." },
  { id: "tuff", name: "Tuff", rarity: "common", tags: ["volcanic", "hawaii"], hint: "Ashy volcanic rock — layers of old ash that stuck together." },
  { id: "pumice", name: "Pumice", rarity: "uncommon", tags: ["volcanic", "hawaii"], hint: "Light and frothy — sometimes floats!" },
  { id: "obsidian", name: "Obsidian", rarity: "rare", tags: ["volcanic"], hint: "Glassy black volcanic glass." },
  { id: "limestone", name: "Limestone", rarity: "common", tags: ["sedimentary"], hint: "Often pale; may have shell bits." },
  { id: "sandstone", name: "Sandstone", rarity: "common", tags: ["sedimentary"], hint: "Sand grains stuck together." },
  { id: "shale", name: "Shale", rarity: "common", tags: ["sedimentary"], hint: "Soft layered mud rock." },
  { id: "conglomerate", name: "Conglomerate", rarity: "uncommon", tags: ["sedimentary"], hint: "Pebbles cemented into one rock." },
  { id: "granite", name: "Granite", rarity: "common", tags: ["igneous"], hint: "Speckled pink/gray/white crystals." },
  { id: "gabbro", name: "Gabbro", rarity: "uncommon", tags: ["igneous"], hint: "Dark coarse-grained cousin of basalt." },
  { id: "rhyolite", name: "Rhyolite", rarity: "uncommon", tags: ["igneous"], hint: "Light volcanic rock, often pinkish." },
  { id: "andesite", name: "Andesite", rarity: "common", tags: ["igneous"], hint: "Medium-gray volcanic rock." },
  { id: "quartz", name: "Quartz", rarity: "common", tags: ["mineral", "rockshop"], hint: "Hard, glassy; many colors." },
  { id: "rose_quartz", name: "Rose quartz", rarity: "uncommon", tags: ["mineral", "rockshop"], hint: "Pink quartz — often polished or tumbled." },
  { id: "smoky_quartz", name: "Smoky quartz", rarity: "uncommon", tags: ["mineral", "rockshop"], hint: "Brown-gray transparent quartz." },
  { id: "citrine", name: "Citrine", rarity: "uncommon", tags: ["mineral", "rockshop"], hint: "Yellow to orange quartz — often rock-shop polished." },
  { id: "amethyst", name: "Amethyst", rarity: "rare", tags: ["mineral", "rockshop"], hint: "Purple quartz crystal." },
  { id: "tigers_eye", name: "Tiger's eye", rarity: "uncommon", tags: ["mineral", "rockshop"], hint: "Golden-brown chatoyant stone, often polished." },
  { id: "fluorite", name: "Fluorite", rarity: "uncommon", tags: ["mineral", "rockshop"], hint: "Purple/green glassy cubes or chunks." },
  { id: "howlite", name: "Howlite", rarity: "uncommon", tags: ["mineral", "rockshop"], hint: "White with gray veins — often dyed turquoise-blue in shops." },
  { id: "sodalite", name: "Sodalite", rarity: "uncommon", tags: ["mineral", "rockshop"], hint: "Deep blue with white streaks." },
  { id: "calcite", name: "Calcite", rarity: "common", tags: ["mineral"], hint: "Softer than glass; may fizz with vinegar." },
  { id: "feldspar", name: "Feldspar", rarity: "common", tags: ["mineral"], hint: "Blocky crystals in granite." },
  { id: "mica", name: "Mica", rarity: "uncommon", tags: ["mineral"], hint: "Flaky shiny sheets." },
  { id: "pyrite", name: "Pyrite", rarity: "uncommon", tags: ["mineral"], hint: "Fool’s gold — metallic cubes." },
  { id: "hematite", name: "Hematite", rarity: "uncommon", tags: ["mineral"], hint: "Reddish iron mineral; heavy." },
  { id: "magnetite", name: "Magnetite", rarity: "uncommon", tags: ["mineral"], hint: "Magnetic iron oxide." },
  { id: "olivine", name: "Olivine (Peridot)", rarity: "uncommon", tags: ["mineral", "hawaii"], hint: "Green crystals in some lava rocks." },
  { id: "coral", name: "Coral / Coral rubble", rarity: "common", tags: ["biogenic", "hawaii"], hint: "Beach white/pink pieces — leave living reefs alone!" },
  { id: "beach_glass", name: "Beach glass", rarity: "uncommon", tags: ["manmade", "beach"], hint: "Frosty tumbled glass (not a rock, still cool!)." },
  { id: "chert", name: "Chert", rarity: "uncommon", tags: ["sedimentary"], hint: "Hard, smooth, sharp edges." },
  { id: "gneiss", name: "Gneiss", rarity: "uncommon", tags: ["metamorphic"], hint: "Banded stripes of light and dark." },
  { id: "schist", name: "Schist", rarity: "uncommon", tags: ["metamorphic"], hint: "Shiny, flaky metamorphic rock." },
  { id: "marble", name: "Marble", rarity: "uncommon", tags: ["metamorphic"], hint: "Recrystallized limestone; often swirly." },
  { id: "slate", name: "Slate", rarity: "common", tags: ["metamorphic"], hint: "Splits into flat sheets." },
  { id: "agate", name: "Agate", rarity: "rare", tags: ["mineral"], hint: "Banded colorful silica." },
  { id: "jasper", name: "Jasper", rarity: "uncommon", tags: ["mineral"], hint: "Opaque colorful silica rock." },
  // Ultra rare / legendary — extremely uncommon kid finds
  { id: "diamond", name: "Diamond", rarity: "ultra", tags: ["gem", "mineral"], hint: "Super hard crystal — almost never found casually!" },
  { id: "ruby", name: "Ruby", rarity: "ultra", tags: ["gem", "mineral"], hint: "Deep red gem corundum — legendary lucky find." },
  { id: "sapphire", name: "Sapphire", rarity: "ultra", tags: ["gem", "mineral"], hint: "Blue (or other) gem corundum — ultra rare in the field." },
  { id: "emerald", name: "Emerald", rarity: "ultra", tags: ["gem", "mineral"], hint: "Green beryl gem — museum-level lucky!" },
  { id: "gold_nugget", name: "Native gold", rarity: "ultra", tags: ["mineral"], hint: "Real gold is extremely rare to stumble on." },
];

export const RARITY_META = {
  common: { label: "Common", stars: 1, color: "#94a3b8", emoji: "⭐" },
  uncommon: { label: "Uncommon", stars: 2, color: "#22c55e", emoji: "⭐⭐" },
  rare: { label: "Rare", stars: 3, color: "#8b5cf6", emoji: "⭐⭐⭐" },
  ultra: { label: "Ultra Rare", stars: 4, color: "#f59e0b", emoji: "⭐⭐⭐⭐" },
};

export const RARITY_ORDER = ["common", "uncommon", "rare", "ultra"];

export function rarityStars(rarity) {
  const n = RARITY_META[rarity]?.stars || 1;
  return "★".repeat(n) + "☆".repeat(4 - n);
}

export function catalogById(id) {
  if (!id) return null;
  const key = String(id).toLowerCase().replace(/\s+/g, "_");
  return ROCK_CATALOG.find((r) => r.id === key || r.name.toLowerCase() === String(id).toLowerCase()) || null;
}

export function normalizeRockId(name) {
  if (!name) return "unknown";
  const lower = name.toLowerCase();
  const hit = ROCK_CATALOG.find(
    (r) => lower.includes(r.name.toLowerCase()) || lower.includes(r.id.replace(/_/g, " "))
  );
  if (hit) return hit.id;
  return lower
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "unknown";
}

export function normalizeRarity(r) {
  const x = String(r || "common").toLowerCase();
  if (x === "legendary" || x === "ultra_rare" || x === "ultra-rare") return "ultra";
  if (RARITY_ORDER.includes(x)) return x;
  return "common";
}
