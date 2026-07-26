import { ROCK_CATALOG, catalogById, RARITY_META } from "./data/catalog.js";
import {
  PUBLIC_SPOTS,
  RANGE_PRESETS,
  distanceKm,
  driveTimeInRange,
  estimateDriveMinutes,
  formatDriveTime,
  getPhotoChallenge,
} from "./data/spots.js";
import { CHANCE_META, SPOT_MISSIONS } from "./data/spot-missions.js";

/** How many places to show first / each “Show more” tap */
export const SPOTS_PAGE_SIZE = 6;

/**
 * Default check-in radius (~1.2 km). Real phone GPS on Oahu trails drifts;
 * long hikes can override per-spot with checkInRadiusKm.
 */
export const CHECKIN_RADIUS_KM = 1.2;

/** Photo challenge proximity — still requires vision match for unlock */
export const PHOTO_CHALLENGE_RADIUS_KM = 1.6;

export { getPosition, watchPosition, clearWatch } from "./permissions.js";

/** Effective check-in radius for a spot, inflated slightly by GPS accuracy */
export function checkInRadiusKm(spot, loc = null) {
  const base = spot?.checkInRadiusKm ?? CHECKIN_RADIUS_KM;
  const accM = loc?.accuracy != null && Number.isFinite(loc.accuracy) ? loc.accuracy : 40;
  // Add up to 250 m for poor GPS, never less than base
  const padKm = Math.min(0.25, Math.max(0, (accM - 25) / 1000));
  return base + padKm;
}

export function photoChallengeRadiusKm(spot, loc = null) {
  const base = spot?.challengeRadiusKm ?? PHOTO_CHALLENGE_RADIUS_KM;
  const accM = loc?.accuracy != null && Number.isFinite(loc.accuracy) ? loc.accuracy : 40;
  const padKm = Math.min(0.3, Math.max(0, (accM - 25) / 1000));
  return base + padKm;
}

export function regionFlavor(loc) {
  if (!loc) return "general";
  if (loc.lat > 18.5 && loc.lat < 22.5 && loc.lng > -161 && loc.lng < -154) return "hawaii";
  return "general";
}

export function suggestRocks(loc, rangeKey = "medium") {
  const flavor = regionFlavor(loc);
  const pool = ROCK_CATALOG.filter((r) => {
    if (flavor === "hawaii") return r.rarity !== "ultra" || r.tags.includes("gem");
    return true;
  });

  const commons = pool.filter((r) => r.rarity === "common");
  const uncommons = pool.filter((r) => r.rarity === "uncommon");
  const rares = pool.filter((r) => r.rarity === "rare");
  const ultras = pool.filter((r) => r.rarity === "ultra");

  const pick = (arr, n) => {
    const copy = [...arr].sort(() => Math.random() - 0.5);
    return copy.slice(0, n);
  };

  let commonPick = pick(commons, 4);
  if (flavor === "hawaii") {
    const hiCommon = commons.filter(
      (r) => r.tags.includes("hawaii") || r.tags.includes("volcanic") || r.tags.includes("biogenic")
    );
    commonPick = [...pick(hiCommon, 3), ...pick(commons, 2)].slice(0, 4);
  }

  return {
    range: RANGE_PRESETS[rangeKey],
    flavor,
    common: commonPick,
    uncommon: pick(uncommons, 2),
    rare: pick(rares, 2),
    ultra: pick(ultras, 1),
  };
}

export function suggestSpots(loc, rangeKey = "medium", collectorStats = null) {
  const flavor = regionFlavor(loc);

  const withDrive = PUBLIC_SPOTS.map((s) => {
    if (s.generic) {
      return {
        ...s,
        distanceKm: null,
        driveMin: null,
        inRange: false, // generics only if no real spots match this band
        canCheckIn: !!loc,
        driveLabel: "Near you",
      };
    }
    if (!loc) {
      return {
        ...s,
        distanceKm: null,
        driveMin: null,
        inRange: false,
        canCheckIn: false,
        driveLabel: "Turn on location",
      };
    }
    const d = distanceKm(loc, s);
    const driveMin = estimateDriveMinutes(loc, s, flavor);
    // Exclusive band: Short / Medium / Longer never overlap
    const inRange = driveTimeInRange(driveMin, rangeKey);
    const cinR = checkInRadiusKm(s, loc);
    return {
      ...s,
      distanceKm: d,
      driveMin,
      inRange,
      canCheckIn: d <= cinR,
      checkInRadiusKm: cinR,
      driveLabel: formatDriveTime(driveMin),
    };
  });

  // Full list, nearest-first — UI paginates with “Show more” / infinite scroll
  const nearby = withDrive
    .filter((s) => !s.generic && s.driveMin != null && s.inRange)
    .sort((a, b) => a.driveMin - b.driveMin);

  if (nearby.length) {
    return nearby.map((s) => enrichSpotRocks(s, collectorStats));
  }

  // No GPS yet — full named list so kids can still browse & Show more
  if (!loc) {
    const samples = PUBLIC_SPOTS.filter((s) => !s.generic).map((s) =>
      enrichSpotRocks(
        {
          ...s,
          distanceKm: null,
          driveMin: null,
          inRange: false,
          canCheckIn: false,
          driveLabel: "Turn on location",
        },
        collectorStats
      )
    );
    return samples.length
      ? samples
      : withDrive.filter((s) => s.generic).map((s) => enrichSpotRocks(s, collectorStats));
  }

  // GPS on but nothing in this exclusive band — gentle empty state via generics
  // only for Short (nearby ideas); Medium/Longer return empty so UI can say so
  if (rangeKey === "short") {
    return withDrive.filter((s) => s.generic).map((s) => enrichSpotRocks(s, collectorStats));
  }
  return [];
}

/**
 * Enrich a spot with unique mission + varied rock finds (likely / lucky / longshot).
 * Optional collectorStats: { checkInSpotIds: Set, outdoorSpotIds: Set } for “few collectors” hooks.
 */
export function enrichSpotRocks(spot, collectorStats = null) {
  const mission = buildSpotMission(spot, collectorStats);
  return {
    ...spot,
    mission,
    rockFinds: mission.finds,
    rockHunt: mission.hook,
  };
}

/**
 * Build the full kid-facing mission for a place.
 */
export function buildSpotMission(spot, collectorStats = null) {
  const preset = SPOT_MISSIONS[spot.id] || fallbackMission(spot);
  const finds = (preset.finds || []).map((f) => resolveFindEntry(f)).filter(Boolean);

  // Sort: likely first, then lucky, then longshot
  const order = { likely: 0, lucky: 1, longshot: 2 };
  finds.sort((a, b) => (order[a.chance] ?? 9) - (order[b.chance] ?? 9));

  const collectorHook = buildCollectorHook(spot, collectorStats);

  return {
    emoji: preset.emoji || "🪨",
    title: preset.title || "Rock Hunt Mission",
    hook: preset.hook || "Go find something cool!",
    lookFor: preset.lookFor || "Look for color, texture, and shiny bits.",
    rarityTease: preset.rarityTease || "",
    miniChallenge: preset.miniChallenge || "Find a rock + take the place photo for bonus XP!",
    collectorHook,
    finds,
  };
}

function resolveFindEntry(entry) {
  if (!entry?.id) return null;
  const key = String(entry.id).toLowerCase().replace(/\s+/g, "_");
  const cat = catalogById(key);
  const chance = entry.chance || "likely";
  const chanceMeta = CHANCE_META[chance] || CHANCE_META.likely;
  const rarity = cat?.rarity || (chance === "longshot" ? "rare" : chance === "lucky" ? "uncommon" : "common");
  return {
    id: key,
    name: cat?.name || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    rarity,
    rarityLabel: RARITY_META[rarity]?.label || rarity,
    hint: cat?.hint || "",
    look: entry.look || cat?.hint || "Keep your eyes open!",
    chance,
    chanceLabel: chanceMeta.label,
    chanceShort: chanceMeta.short,
    chanceEmoji: chanceMeta.emoji,
    chanceClass: chanceMeta.className,
  };
}

/** Soft “collection incentive” using local check-ins / outdoor finds when available */
function buildCollectorHook(spot, collectorStats) {
  if (!spot?.id || spot.generic) {
    return "Every new place adds a chapter to your Rock Dex adventure!";
  }
  if (!collectorStats) {
    return "Only a few explorers log rocks from each special place — will you be one?";
  }
  const checked = collectorStats.checkInSpotIds?.has(spot.id);
  const hasOutdoor = collectorStats.outdoorSpotIds?.has(spot.id);
  if (checked && hasOutdoor) {
    return "You’ve checked in here — can you add a rock ID from this place to your Dex?";
  }
  if (checked) {
    return "You’re on the map here! Next mission: Identify a rock found at this spot.";
  }
  if (hasOutdoor) {
    return "You already saved an outdoor find near here — come back to check in & photo challenge!";
  }
  // Deterministic “scarcity” flavor from spot id (not real multiplayer counts)
  const n = simpleHash(spot.id) % 5;
  const lines = [
    "Almost nobody in your crew has a rock story from this exact place yet!",
    "This stop is still a blank page in most kids’ Dex — be an early explorer!",
    "Rare visit badge energy: few collectors bag a find from this far-out spot.",
    "Secret-level place energy: not every rock kid makes it here!",
    "Explorer bragging rights await — log a rock from this location!",
  ];
  return lines[n];
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Fallback if a spot has no mission entry yet */
function fallbackMission(spot) {
  const kinds = spot.kinds || ["basalt"];
  const finds = kinds.slice(0, 3).map((id, i) => ({
    id,
    chance: i === 0 ? "likely" : i === 1 ? "lucky" : "longshot",
    look: KIND_LOOK[id] || "Interesting rock texture!",
  }));
  // Ensure at least one lucky tease
  if (finds.length === 1) {
    finds.push({ id: "scoria", chance: "lucky", look: "Holey lava if you’re sharp-eyed" });
  }
  return {
    emoji: "🪨",
    title: "Rock Hunt Mission",
    hook: `Explore ${spot.name || "this place"} for cool rocks and textures!`,
    lookFor: "Watch for colors, holes, sparkles, and smooth vs rough surfaces.",
    rarityTease: "Lucky finds hide in plain sight — take your time!",
    miniChallenge: "Find a rock + snap the place highlight for bonus XP!",
    finds,
  };
}

const KIND_LOOK = {
  basalt: "Dark lava rock — black or gray",
  scoria: "Bubbly holey volcanic rock",
  tuff: "Pale ashy volcanic rock",
  andesite: "Medium-gray volcanic rock",
  olivine: "Tiny green crystals in lava",
  coral: "Pale rubble (never living coral)",
  limestone: "Pale rock, maybe shell bits",
  beach_glass: "Frosty tumbled glass",
  conglomerate: "Pebbles stuck in one rock",
  sandstone: "Sand grains cemented together",
  granite: "Speckled crystal rock",
  quartz: "Hard glassy mineral",
  shale: "Soft layered mud rock",
  slate: "Flat dark sheets",
};

/**
 * Validate check-in: must have GPS; named spots need proximity; generic needs location only.
 */
export function canCheckInAt(spot, loc) {
  if (!loc) return { ok: false, reason: "Turn on location first." };
  if (spot.generic) return { ok: true, reason: null };
  if (spot.lat == null) return { ok: false, reason: "This spot needs a map pin." };
  const d = distanceKm(loc, spot);
  const radius = checkInRadiusKm(spot, loc);
  if (d <= radius) return { ok: true, reason: null, distanceKm: d, radiusKm: radius };
  const flavor = regionFlavor(loc);
  const driveMin = estimateDriveMinutes(loc, spot, flavor);
  const metersOut = Math.round((d - radius) * 1000);
  return {
    ok: false,
    reason: `Almost! About ${metersOut > 80 ? formatDriveTime(driveMin) : `${metersOut} m`} farther for check-in (GPS can wobble on trails — walk a bit and retry).`,
    distanceKm: d,
    driveMin,
    radiusKm: radius,
  };
}

export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return "Near you";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const miles = km * 0.621371;
  return `${km.toFixed(1)} km · ${miles.toFixed(1)} mi`;
}

/**
 * Spots the user is physically near enough to photo-challenge / check in.
 * Sorted closest-first. Pass completedIds (Set of spotId) to flag done challenges.
 */
export function getNearbyChallengeSpots(loc, { completedIds = new Set(), radiusKm = null } = {}) {
  if (!loc) return [];
  return PUBLIC_SPOTS.filter((s) => !s.generic && s.lat != null)
    .map((s) => {
      const d = distanceKm(loc, s);
      const challenge = getPhotoChallenge(s);
      const chR = radiusKm != null ? radiusKm : photoChallengeRadiusKm(s, loc);
      const cinR = checkInRadiusKm(s, loc);
      return {
        ...s,
        distanceKm: d,
        canCheckIn: d <= cinR,
        canPhotoChallenge: d <= chR,
        challengeDone: completedIds.has(s.id),
        photoChallenge: challenge,
        driveLabel: formatDistance(d),
      };
    })
    .filter((s) => s.canPhotoChallenge)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Closest incomplete photo challenge, or null */
export function getActivePhotoChallenge(loc, completedIds = new Set()) {
  const near = getNearbyChallengeSpots(loc, { completedIds });
  return near.find((s) => !s.challengeDone) || near[0] || null;
}

export { formatDriveTime, RANGE_PRESETS, getPhotoChallenge, PUBLIC_SPOTS };
