import { BADGES, LEVELS, XP_REWARDS, levelFromXp } from "./data/badges-data.js";
import { addXp, getStats, getXp, saveBadgesEarned } from "./store.js";
import { celebrateBadge, toast } from "./ui.js";

export async function evaluateBadges({ celebrate = true } = {}) {
  const stats = await getStats();
  const levelInfo = levelFromXp(stats.xp);
  const snapshot = {
    ...stats,
    level: levelInfo.current.level,
  };
  const earned = new Set(stats.badges);
  const newly = [];
  for (const badge of BADGES) {
    if (earned.has(badge.id)) continue;
    try {
      if (badge.check(snapshot)) {
        earned.add(badge.id);
        newly.push(badge);
      }
    } catch {
      /* ignore */
    }
  }
  if (newly.length) {
    await saveBadgesEarned([...earned]);
    for (const b of newly) {
      await addXp(XP_REWARDS.badge);
      if (celebrate) celebrateBadge(b);
    }
    toast(`+${newly.length} badge${newly.length > 1 ? "s" : ""}!`, "success");
  }
  const xp = await getXp();
  return { newly, earned: [...earned], level: levelFromXp(xp) };
}

export async function grantIdentifyXp({ isNewType = false } = {}) {
  let total = XP_REWARDS.identify;
  if (isNewType) total += XP_REWARDS.identifyNewType;
  return addXp(total);
}

export async function grantCollectXp({ isNewType, rarity, outdoor = false }) {
  let total = isNewType ? XP_REWARDS.collectNew : XP_REWARDS.collectDupe;
  if (isNewType && rarity === "rare") total += XP_REWARDS.firstRare;
  if (isNewType && rarity === "ultra") total += XP_REWARDS.firstUltra;
  if (outdoor) total += XP_REWARDS.outdoorBonus || 0;
  return addXp(total);
}

export async function grantAdventurePhotoXp() {
  return addXp(XP_REWARDS.adventurePhoto || 5);
}

/** One-time bonus when completing a location’s specific photo challenge */
export async function grantPhotoChallengeXp() {
  return addXp(XP_REWARDS.photoChallenge || 12);
}

export async function grantCheckInXp({ isNewSpot }) {
  let total = XP_REWARDS.checkIn;
  if (isNewSpot) total += XP_REWARDS.checkInNewSpot;
  return addXp(total);
}

export async function grantFieldTestXp() {
  return addXp(XP_REWARDS.fieldTestRound);
}

export function renderLevelBar(xp) {
  const { current, next, progress } = levelFromXp(xp);
  const pct = Math.round(progress * 100);
  return `
    <div class="level-card">
      <div class="level-top">
        <span class="level-emoji">${current.emoji}</span>
        <div>
          <p class="eyebrow">Level ${current.level}</p>
          <h3>${current.title}</h3>
        </div>
        <div class="level-xp">${xp} XP</div>
      </div>
      <div class="xp-track" aria-label="Progress to next level">
        <div class="xp-fill" style="width:${pct}%"></div>
      </div>
      <p class="muted small">
        ${next ? `Next: ${next.title} at ${next.xp} XP` : "Max adventure rank — Crystal Master!"}
      </p>
    </div>
  `;
}

export function allBadgesWithStatus(earnedIds) {
  const set = new Set(earnedIds);
  return BADGES.map((b) => ({ ...b, unlocked: set.has(b.id) }));
}

export { LEVELS, BADGES, levelFromXp, XP_REWARDS };
