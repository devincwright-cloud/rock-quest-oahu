import {
  addAdventurePhoto,
  addCheckIn,
  addFind,
  bumpIdentifyCount,
  completePhotoChallenge,
  deleteAdventureAlbum,
  deleteAdventurePhoto,
  getAdventureAlbum,
  getAdventureAlbums,
  getAdventurePhotos,
  getAllFinds,
  getPhotoChallengesCompleted,
  renameAdventureAlbum,
  getAllSeen,
  getCheckIns,
  getFind,
  getStats,
  getXp,
  markSeen,
  setFlag,
  updateFind,
} from "./store.js";
import { clearVisionStatusCache, fileToDataUrl, getVisionStatus, identifyRock, saveApiKey } from "./identify.js";
import {
  evaluateBadges,
  grantAdventurePhotoXp,
  grantCheckInXp,
  grantCollectXp,
  grantFieldTestXp,
  grantIdentifyXp,
  grantPhotoChallengeXp,
  renderLevelBar,
  allBadgesWithStatus,
  levelFromXp,
} from "./badges.js";
import {
  canCheckInAt,
  formatDistance,
  getActivePhotoChallenge,
  getNearbyChallengeSpots,
  getPhotoChallenge,
  getPosition,
  PUBLIC_SPOTS,
  SPOTS_PAGE_SIZE,
  suggestRocks,
  suggestSpots,
} from "./explore.js";
import { formatCoords, osmEmbedUrl, osmLink, reverseGeocode } from "./geo.js";
import { adjustedConfidence, formatAnswer, testsComplete } from "./fieldtests.js";
import { rarityBadge, setActiveNav, showModal, sparkleBurst, toast, conf, $ } from "./ui.js";
import { rarityStars } from "./data/catalog.js";
import { BADGES, LEVELS, XP_REWARDS } from "./data/badges-data.js";
import { getBadgesEarned } from "./store.js";

const state = {
  route: "home",
  photoDataUrl: null,
  lastResult: null,
  location: null,
  range: "medium",
  /** How many explore places are visible (Show more / infinite scroll) */
  spotShowCount: SPOTS_PAGE_SIZE,
  dexView: "grid",
  dexFilter: "all",
  stream: null,
  visionStatus: null,
  /** Field-test XP already granted for this ID session (by candidate index) */
  fieldXpAwarded: new Set(),
  /** When set, Dex detail shows interactive field-test edit for this find id */
  editingFieldTestsFor: null,
  /** Identify-time: found outside on an adventure (soft geo prior + save location) */
  foundOutside: false,
  outdoorLocation: null,
  /** Explore: open adventure album id, or null for album list */
  adventureAlbumId: null,
  /** Explore: adventure camera overlay open (phone-first snap flow) */
  adventureCamOpen: false,
  /** Spot id when camera opened for a location photo challenge */
  challengeSpotId: null,
};

const app = $("#app");

function navigate(route) {
  state.route = route;
  setActiveNav(route);
  closeAdventureCamera();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
}

function closeAdventureCamera({ clearChallenge = true } = {}) {
  state.adventureCamOpen = false;
  if (clearChallenge) state.challengeSpotId = null;
  stopCamera();
}

function openAdventureCamera({ challengeSpotId = null } = {}) {
  state.challengeSpotId = challengeSpotId;
  state.adventureCamOpen = true;
  stopCamera();
}

function bindAdventureCameraControls() {
  $("#btn-adv-cam-close")?.addEventListener("click", async () => {
    closeAdventureCamera();
    await render();
  });
  $("#btn-adv-cam-cancel")?.addEventListener("click", async () => {
    closeAdventureCamera();
    await render();
  });

  $("#btn-adv-snap")?.addEventListener("click", async () => {
    const v = $("#adv-cam-video");
    if (!v || !v.videoWidth) {
      toast("Camera still starting… try again!", "error");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d").drawImage(v, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      // Keep challengeSpotId until photo is saved
      closeAdventureCamera({ clearChallenge: false });
      await saveAdventurePhotoFromDataUrl(dataUrl);
    } catch (err) {
      toast(err.message || "Could not snap photo", "error");
    }
  });

  $("#adv-photo-input")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, 900, 0.75);
      closeAdventureCamera({ clearChallenge: false });
      await saveAdventurePhotoFromDataUrl(dataUrl);
    } catch (err) {
      toast(err.message || "Could not save photo", "error");
    }
  });
}

async function render({ preserveScroll = false } = {}) {
  const scrollY = preserveScroll ? window.scrollY : 0;
  const routes = {
    home: renderHome,
    identify: renderIdentify,
    dex: renderDex,
    explore: renderExplore,
    path: renderPath,
    badges: renderPath, // legacy hash
  };
  const fn = routes[state.route] || renderHome;
  if (!preserveScroll) {
    app.innerHTML = `<div class="screen loading-screen"><div class="spinner"></div><p>Loading Rock Quest Oahu…</p></div>`;
  }
  try {
    if (!state.visionStatus) state.visionStatus = await getVisionStatus();
    app.innerHTML = await fn();
    bindScreen();
    if (preserveScroll) {
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="screen"><div class="card"><h2>Oops!</h2><p>${escapeHtml(e.message)}</p><button class="btn btn-primary" data-go="home">Home</button></div></div>`;
    bindScreen();
  }
}

async function renderHome() {
  const stats = await getStats();
  const xp = await getXp();
  const completed = await getPhotoChallengesCompleted();
  const completedIds = new Set(Object.keys(completed));
  const nearChallenge = state.location
    ? getActivePhotoChallenge(state.location, completedIds)
    : null;
  const nearDone = nearChallenge?.challengeDone;

  return `
    <section class="screen home-screen">
      <header class="hero-banner">
        <p class="eyebrow">Island adventure awaits</p>
        <h1>Rock Quest Oahu 🪨</h1>
        <p class="lead">Snap rocks across the island. Fill your Dex. Earn badges. Check in at real spots!</p>
        <button class="btn btn-primary btn-xl" data-go="identify">📷 Start Identifying</button>
      </header>
      ${renderLevelBar(xp)}
      <div class="stat-row">
        <div class="stat-pill"><strong>${stats.stats.seenTypes}</strong><span>Seen</span></div>
        <div class="stat-pill"><strong>${stats.stats.collectedCount}</strong><span>Collected</span></div>
        <div class="stat-pill"><strong>${stats.stats.checkInCount}</strong><span>Check-ins</span></div>
      </div>
      ${
        nearChallenge
          ? renderNearChallengeCard(nearChallenge, { done: nearDone, compact: false })
          : state.location
            ? `<div class="card challenge-idle">
                <h3>🎯 Location photo challenges</h3>
                <p class="muted small">When you’re at a suggested place, we’ll ask you to snap its <strong>famous highlight</strong> (lighthouse, lookout, waterfall…) for bonus XP!</p>
                <button type="button" class="btn btn-secondary btn-full" data-go="explore">🗺️ See adventure places</button>
              </div>`
            : `<div class="card challenge-idle">
                <h3>🎯 Location photo challenges</h3>
                <p class="muted small">Turn on location in Explore — when you’re near a place, we’ll challenge you to photo its real highlight!</p>
                <button type="button" class="btn btn-secondary btn-full" data-go="explore">🗺️ Explore nearby</button>
              </div>`
      }
      <div class="card-grid home-actions">
        <button class="action-card" data-go="identify"><span>📷</span><strong>Identify</strong><em>Camera magic</em></button>
        <button class="action-card" data-go="dex"><span>📘</span><strong>Rock Dex</strong><em>Your collection</em></button>
        <button class="action-card" data-go="explore"><span>🗺️</span><strong>Explore</strong><em>Go on an adventure</em></button>
        <button class="action-card" data-go="path"><span>🛤️</span><strong>Path</strong><em>Levels &amp; badges</em></button>
      </div>
      <div class="tip-card">
        <strong>Explorer tip</strong>
        <p>At each place, snap what it’s <em>known for</em> — not just any scenery — to complete photo challenges and earn XP!</p>
      </div>
      ${renderAdventureCameraOverlay()}
    </section>
  `;
}

function renderNearChallengeCard(spot, { done = false, compact = false } = {}) {
  const ch = spot.photoChallenge || getPhotoChallenge(spot);
  const dist =
    spot.distanceKm != null && Number.isFinite(spot.distanceKm)
      ? formatDistance(spot.distanceKm)
      : "Right here";
  return `
    <div class="card challenge-card ${done ? "challenge-done" : "challenge-active"}">
      <div class="challenge-badge">${done ? "✅" : ch.emoji || "🎯"} Photo challenge${done ? " done!" : ""}</div>
      <h3>${escapeHtml(spot.name)}</h3>
      <p class="muted small">${escapeHtml(spot.area || "")} · ${escapeHtml(dist)} away</p>
      <p class="challenge-prompt"><strong>${escapeHtml(ch.title || "Highlight")}:</strong> ${escapeHtml(ch.prompt)}</p>
      ${
        done
          ? `<p class="checkin-done">You snapped the highlight here — nice eyes! 🎉</p>`
          : `<p class="muted small">+${XP_REWARDS.photoChallenge || 12} XP when you snap this specific highlight</p>
             <button type="button" class="btn btn-primary btn-full" data-challenge-snap="${escapeAttr(spot.id)}">
               📸 Snap the highlight!
             </button>`
      }
      ${compact ? "" : `<button type="button" class="btn btn-ghost btn-full" data-go="explore">Open Explore</button>`}
    </div>`;
}

function visionBannerHtml() {
  const v = state.visionStatus;
  if (v?.vision) {
    return `<div class="mode-banner mode-live">🔭 Live Vision is on${v.model ? ` (${escapeHtml(v.model)})` : ""} — real AI rock eyes!</div>`;
  }
  return `
    <div class="mode-banner mode-explorer">
      <strong>Vision key needed for real IDs</strong>
      <p style="margin:0.4rem 0 0;font-weight:700">Without an xAI API key, identification cannot analyze photos.</p>
      <p class="muted small" style="margin-top:0.45rem"><strong>Live Netlify site:</strong> a parent adds <code>XAI_API_KEY</code> in Netlify → Environment variables, then redeploys (keys can’t be saved from the phone on the live site).</p>
      <p class="muted small"><strong>Local Mac:</strong> paste below or put it in <code>rock-quest/.env</code>.</p>
      <div class="key-setup">
        <input class="text-input" id="api-key-input" type="password" autocomplete="off" placeholder="xai-... paste XAI_API_KEY (local only)" />
        <button type="button" class="btn btn-primary" id="btn-save-key">Save key locally</button>
      </div>
      <p class="muted small" style="margin-top:0.5rem">Get a key at <a href="https://console.x.ai" target="_blank" rel="noopener">console.x.ai</a></p>
    </div>`;
}

async function renderIdentify() {
  const hasPhoto = !!state.photoDataUrl;
  const result = state.lastResult;
  return `
    <section class="screen identify-screen">
      <header class="screen-header">
        <h1>Identify</h1>
        <p>Point your camera at a rock — or pick a photo from your gallery.</p>
      </header>
      ${visionBannerHtml()}

      <div class="camera-card">
        <div class="viewfinder ${hasPhoto ? "has-photo" : ""}" id="viewfinder">
          ${
            hasPhoto
              ? `<img src="${state.photoDataUrl}" alt="Rock photo preview" id="preview-img" />`
              : `<video id="cam-video" playsinline autoplay muted></video>
                 <div class="viewfinder-hint">📷 Camera preview</div>`
          }
          <div class="new-sparkle-banner hidden" id="new-banner">✨ NEW in your Dex!</div>
        </div>
        <div class="camera-actions">
          <button class="btn btn-secondary" type="button" id="btn-start-cam">Open camera</button>
          <button class="btn btn-secondary" type="button" id="btn-snap" ${hasPhoto ? "" : "disabled"}>Snap</button>
          <label class="btn btn-secondary file-btn">
            Gallery
            <input type="file" id="file-input" accept="image/*" capture="environment" hidden />
          </label>
        </div>
        <label class="check-row outdoor-id-check">
          <input type="checkbox" id="id-outdoor-check" ${state.foundOutside ? "checked" : ""} />
          🌞 Found outside / on an adventure
        </label>
        <p class="muted small outdoor-id-hint">
          Checked: uses your location only as a <strong>gentle</strong> geography hint (visual evidence still wins).
          Unchecked: no location bias at all.
        </p>
        <button class="btn btn-primary btn-xl btn-full" id="btn-identify" ${hasPhoto ? "" : "disabled"}>
          ✨ Identify this rock!
        </button>
        ${hasPhoto ? `<button class="btn btn-ghost btn-full" id="btn-clear-photo" type="button">Clear photo</button>` : ""}
      </div>

      <div id="identify-status" class="identify-status hidden"></div>
      <div id="identify-results">${result ? renderResult(result) : ""}</div>
    </section>
  `;
}

function renderResult(result) {
  return `
    <div class="results-block" id="results-block">
      <div class="demo-banner live">🔭 Live Vision${result.model ? ` · ${escapeHtml(result.model)}` : ""} — confirm with field tests, then save!</div>
      <p class="summary">${escapeHtml(result.summary)}</p>
      <div class="candidate-list">
        ${result.candidates
          .map((c, i) =>
            renderCandidateCard(c, i, {
              phase: "identify",
              interactiveTests: true,
            })
          )
          .join("")}
      </div>
      <p class="safety-note">⚠️ ${escapeHtml(result.safetyNote || "")}</p>
    </div>
  `;
}

/**
 * @param {'identify'|'dex'} opts.phase
 * @param {boolean} opts.interactiveTests - only true during identify or explicit Dex edit
 */
function renderCandidateCard(c, i, { phase = "identify", interactiveTests = false, findId = null } = {}) {
  const tests = c.fieldTests || [];
  const answers = c.fieldAnswers || {};
  const displayConf = adjustedConfidence(c.baseConfidence ?? c.confidence, tests, answers);
  const showCollect = phase === "identify";

  let fieldBlock = "";
  if (tests.length) {
    if (interactiveTests) {
      fieldBlock = `
      <div class="field-tests" data-field-host data-idx="${i}" ${findId ? `data-find-id="${findId}"` : ""}>
        <h4>Field tests for ${escapeHtml(c.name)}</h4>
        <p class="muted small">Yes/No answers raise or lower confidence for <em>this</em> guess.</p>
        ${tests
          .map((t) => {
            const a = answers[t.id];
            return `
            <div class="field-test-row ${a ? "answered" : ""}" data-test-id="${t.id}">
              <p>${escapeHtml(t.question)}</p>
              <div class="yn">
                <button type="button" class="btn-yn ${a === "yes" ? "on yes" : ""}" data-answer="yes" data-test="${t.id}">Yes</button>
                <button type="button" class="btn-yn ${a === "no" ? "on no" : ""}" data-answer="no" data-test="${t.id}">No</button>
              </div>
            </div>`;
          })
          .join("")}
      </div>`;
    } else {
      // Locked record (Dex) — read-only answers
      fieldBlock = `
      <div class="field-tests field-tests-locked">
        <h4>Field test record</h4>
        <p class="muted small">Locked after save. Use Edit to change answers.</p>
        <ul class="field-record-list">
          ${tests
            .map((t) => {
              const a = answers[t.id];
              return `<li><span>${escapeHtml(t.question)}</span><strong class="ans ans-${a || "none"}">${formatAnswer(a)}</strong></li>`;
            })
            .join("")}
        </ul>
      </div>`;
    }
  }

  return `
    <article class="candidate-card rarity-${c.rarity} ${i === 0 ? "top" : ""}" data-idx="${i}" ${findId ? `data-find-id="${findId}"` : ""}>
      <div class="candidate-head">
        <div>
          <p class="eyebrow">${phase === "identify" ? `Guess #${i + 1}` : "Your find"}</p>
          <h3>${escapeHtml(c.name)}</h3>
        </div>
        <div class="conf-wrap">
          ${rarityBadge(c.rarity)}
          <span class="conf" data-conf-display>${conf(displayConf)}</span>
        </div>
      </div>
      <div class="props">
        <div><strong>Hardness</strong><span>${escapeHtml(c.properties?.hardness || "—")}</span></div>
        <div><strong>Luster</strong><span>${escapeHtml(c.properties?.luster || "—")}</span></div>
        <div><strong>Looks like</strong><span>${escapeHtml(c.properties?.appearance || "—")}</span></div>
      </div>
      <div class="facts">
        <h4>Fun facts</h4>
        <ul>${(c.facts || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("") || "<li>No facts saved</li>"}</ul>
      </div>
      ${fieldBlock}
      <p class="value-note">💡 ${escapeHtml(c.valueNote || "")}</p>
      ${
        showCollect
          ? i === 0
            ? `<button class="btn btn-primary btn-lg btn-full" id="btn-collect" type="button">💾 Save to Rock Dex</button>`
            : `<button class="btn btn-secondary btn-full btn-collect-alt" data-idx="${i}" type="button">Save this guess instead</button>`
          : ""
      }
    </article>`;
}

async function renderDex() {
  const finds = await getAllFinds();
  const seen = await getAllSeen();
  const favorites = finds.filter((f) => f.favorite);
  let list = finds;
  if (state.dexFilter === "favorites") list = favorites;
  if (state.dexFilter === "rare") list = finds.filter((f) => f.rarity === "rare" || f.rarity === "ultra");

  return `
    <section class="screen dex-screen">
      <header class="screen-header">
        <h1>Rock Dex</h1>
        <p class="progress-line">Seen <strong>${seen.length}</strong> · Collected <strong>${finds.length}</strong> · Favorites <strong>${favorites.length}</strong></p>
      </header>

      ${
        favorites.length
          ? `<div class="showcase">
              <h2>⭐ Showcase</h2>
              <div class="showcase-row">
                ${favorites
                  .slice(0, 8)
                  .map(
                    (f) => `
                  <button class="showcase-item" data-find="${f.id}" type="button">
                    ${f.photoDataUrl ? `<img src="${f.photoDataUrl}" alt="" />` : `<span class="ph">🪨</span>`}
                    <em>${escapeHtml(f.nickname || f.name)}</em>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>`
          : `<div class="tip-card"><strong>Showcase empty</strong><p>Tap ⭐ on any rock anytime to pin it here!</p></div>`
      }

      <div class="dex-toolbar">
        <div class="seg">
          <button type="button" data-filter="all" class="${state.dexFilter === "all" ? "on" : ""}">All</button>
          <button type="button" data-filter="favorites" class="${state.dexFilter === "favorites" ? "on" : ""}">Favorites</button>
          <button type="button" data-filter="rare" class="${state.dexFilter === "rare" ? "on" : ""}">Rare+</button>
        </div>
        <div class="seg">
          <button type="button" data-view="grid" class="${state.dexView === "grid" ? "on" : ""}">Grid</button>
          <button type="button" data-view="list" class="${state.dexView === "list" ? "on" : ""}">List</button>
        </div>
      </div>

      ${
        !list.length
          ? `<div class="empty-card"><p>No rocks yet — go identify one!</p><button class="btn btn-primary" data-go="identify">Identify</button></div>`
          : `<div class="dex-${state.dexView}">
              ${list.map((f) => dexCard(f)).join("")}
            </div>`
      }

      <details class="seen-panel">
        <summary>Seen types (${seen.length})</summary>
        <ul class="seen-list">
          ${
            seen.length
              ? seen
                  .map(
                    (s) =>
                      `<li><span>${escapeHtml(s.name)}</span> ${rarityBadge(s.rarity)} <small>×${s.timesSeen}</small></li>`
                  )
                  .join("")
              : "<li>Nothing seen yet</li>"
          }
        </ul>
      </details>
    </section>
  `;
}

function dexCard(f) {
  if (state.dexView === "list") {
    return `
      <article class="dex-list-item rarity-${f.rarity}">
        <button type="button" class="dex-open" data-find="${f.id}">
          ${f.photoDataUrl ? `<img src="${f.photoDataUrl}" alt="" />` : `<div class="ph">🪨</div>`}
          <div>
            <h3>${escapeHtml(f.nickname || f.name)}</h3>
            <p>${escapeHtml(f.name)} · ${rarityStars(f.rarity)}</p>
          </div>
        </button>
        <button type="button" class="fav-toggle ${f.favorite ? "on" : ""}" data-fav="${f.id}" aria-label="Toggle favorite">${f.favorite ? "⭐" : "☆"}</button>
      </article>`;
  }
  return `
    <article class="dex-card rarity-${f.rarity}">
      <button type="button" class="dex-open-card" data-find="${f.id}">
        <div class="dex-thumb">
          ${f.photoDataUrl ? `<img src="${f.photoDataUrl}" alt="" />` : `<span>🪨</span>`}
        </div>
        <h3>${escapeHtml(f.nickname || f.name)}</h3>
        <p>${rarityBadge(f.rarity)}</p>
      </button>
      <button type="button" class="fav-toggle card-fav ${f.favorite ? "on" : ""}" data-fav="${f.id}" aria-label="Toggle favorite">${f.favorite ? "⭐" : "☆"}</button>
    </article>`;
}

async function renderExplore() {
  const range = state.range;
  const loc = state.location;
  const rocks = suggestRocks(loc, range);
  const checkIns = await getCheckIns();
  const checked = new Set(checkIns.map((c) => c.spotId));
  const collectorStats = { checkInSpotIds: checked, outdoorSpotIds: new Set() };
  const allSpots = suggestSpots(loc, range, collectorStats);
  const showCount = Math.max(SPOTS_PAGE_SIZE, state.spotShowCount || SPOTS_PAGE_SIZE);
  const spots = allSpots.slice(0, showCount);
  const remaining = Math.max(0, allSpots.length - spots.length);
  const completedMap = await getPhotoChallengesCompleted();
  const completedIds = new Set(Object.keys(completedMap));
  const nearChallenges = loc ? getNearbyChallengeSpots(loc, { completedIds }) : [];
  const activeNear = nearChallenges.find((s) => !s.challengeDone) || nearChallenges[0] || null;
  const albums = await getAdventureAlbums();
  const openAlbum = state.adventureAlbumId
    ? albums.find((a) => a.id === state.adventureAlbumId) || (await getAdventureAlbum(state.adventureAlbumId))
    : null;

  if (openAlbum) {
    return renderAdventureAlbumDetail(openAlbum);
  }

  return `
    <section class="screen explore-screen">
      <header class="screen-header">
        <h1>Explore Nearby</h1>
        <p>Pick a mission, hunt special rocks, snap the highlight, fill your Dex!</p>
      </header>

      <div class="card">
        <h3>Your location</h3>
        <p class="muted" id="loc-status">${
          loc
            ? `📍 Locked in (±${Math.round(loc.accuracy || 0)} m)`
            : "Needed for drive-time suggestions, check-ins, and outdoor rock pins."
        }</p>
        <button class="btn btn-primary" type="button" id="btn-locate">📍 Use my location</button>
        <p class="muted small" style="margin-top:0.5rem">Location alone doesn’t give XP — check-ins, photo challenges, and outdoor finds do!</p>
      </div>

      ${
        activeNear
          ? renderNearChallengeCard(activeNear, { done: activeNear.challengeDone, compact: true })
          : ""
      }

      <div class="card adventure-albums">
        <h3>📚 Adventure albums</h3>
        <p class="muted small">Each outing gets its own album — grouped by place &amp; day (trail, beach, drive…).</p>
        <button type="button" class="btn btn-secondary btn-full" id="btn-adv-photo" style="margin:0.65rem 0">
          📸 Add photo to today’s adventure
        </button>
        <p class="muted small">Opens your phone camera — snap the trail, beach, or family!</p>
        ${
          albums.length
            ? `<div class="album-list">
                ${albums
                  .map((a) => {
                    const cover = a.photos?.[0]?.dataUrl;
                    const n = a.photos?.length || 0;
                    return `
                    <button type="button" class="album-row" data-open-album="${a.id}">
                      <div class="album-cover">${cover ? `<img src="${cover}" alt="" />` : "🗺️"}</div>
                      <div class="album-info">
                        <strong>${escapeHtml(a.title || "Adventure")}</strong>
                        <span>${escapeHtml(a.subtitle || a.dateKey || "")}</span>
                        <em>${n} photo${n === 1 ? "" : "s"}</em>
                      </div>
                      <span class="album-chevron">›</span>
                    </button>`;
                  })
                  .join("")}
              </div>`
            : `<p class="muted small">No adventures yet — snap a trail or beach view to start an album!</p>`
        }
      </div>
      ${renderAdventureCameraOverlay()}

      <div class="card">
        <h3>How far can we roam?</h3>
        <p class="muted small">Based on <strong>drive time</strong> (not straight-line miles) — better for Oahu roads!</p>
        <div class="range-seg">
          ${["short", "medium", "longer"]
            .map(
              (k) =>
                `<button type="button" class="range-btn ${range === k ? "on" : ""}" data-range="${k}">${
                  k === "short" ? "Short" : k === "medium" ? "Medium" : "Longer"
                }</button>`
            )
            .join("")}
        </div>
        <p class="muted small">${rocks.range.blurb}</p>
      </div>

      <div class="card">
        <h3>Rocks you might spot nearby</h3>
        <p class="muted small">Local-style suggestions for your area — separate from photo ID.</p>
        <div class="maybe-grid">
          ${renderMaybeGroup("Common", rocks.common, "common")}
          ${renderMaybeGroup("Uncommon", rocks.uncommon, "uncommon")}
          ${renderMaybeGroup("Rare maybes", rocks.rare, "rare")}
          ${rocks.ultra?.length ? renderMaybeGroup("Ultra Rare long-shots", rocks.ultra, "ultra") : ""}
        </div>
      </div>

      <div class="card">
        <h3>🪨 Rock hunt missions</h3>
        <p class="muted small">
          <strong>${rocks.range.label}</strong> drives — each place has a unique mission, likely finds, and lucky teases!
          ${
            allSpots.length
              ? ` Showing <strong>${spots.length}</strong> of <strong>${allSpots.length}</strong>.`
              : ""
          }
        </p>
        <div class="spot-list" id="spot-list">
          ${
            spots.length
              ? spots.map((s) => renderSpotCard(s, { loc, checked, completedIds })).join("")
              : `<div class="empty-card">
                  <p>No places in the <strong>${escapeHtml(rocks.range.label)}</strong> drive band from where you are.</p>
                  <p class="muted small">Try a different filter, or hop to another side of the island!</p>
                </div>`
          }
        </div>
        ${
          remaining > 0
            ? `<div class="show-more-wrap" id="spot-show-more-wrap">
                <button type="button" class="btn btn-secondary btn-full" id="btn-show-more-spots">
                  ⬇️ Show more places (${remaining} left)
                </button>
                <p class="muted small center" style="margin-top:0.4rem">Keep scrolling the page — more load as you go!</p>
                <div id="spot-scroll-sentinel" class="spot-scroll-sentinel" aria-hidden="true"></div>
              </div>`
            : allSpots.length
              ? `<p class="muted small center" style="margin-top:0.75rem">That’s every ${escapeHtml(rocks.range.label.toLowerCase())} place we know from here. Try another filter!</p>`
              : ""
        }
      </div>

      <div class="tip-card warn">
        <strong>Collecting rules</strong>
        <p>Only take rocks where it’s allowed. Never climb cliffs. Leave living coral alone. Go with a grown-up!</p>
      </div>
    </section>
  `;
}

function renderMaybeGroup(title, items, rarity) {
  if (!items?.length) return "";
  return `
    <div class="maybe-group">
      <h4>${title}</h4>
      <ul>
        ${items
          .map(
            (r) =>
              `<li class="rarity-${rarity}"><strong>${escapeHtml(r.name)}</strong> ${rarityBadge(r.rarity)}<br/><span class="muted small">${escapeHtml(r.hint)}</span></li>`
          )
          .join("")}
      </ul>
    </div>`;
}

/** One adventure place card — mission + varied finds, then photo challenge & check-in */
function renderSpotCard(s, { loc, checked, completedIds }) {
  const done = checked.has(s.spotId || s.id);
  const id = s.spotId || s.id;
  const gate = canCheckInAt({ ...s, spotId: id }, loc);
  const ch = getPhotoChallenge(s);
  const chDone = completedIds.has(id);
  const nearEnough = loc && s.lat != null && s.distanceKm != null && s.distanceKm <= 1.0;
  const m = s.mission || {};
  const rockFinds = s.rockFinds || m.finds || [];
  const likely = rockFinds.filter((r) => r.chance === "likely");
  const lucky = rockFinds.filter((r) => r.chance === "lucky");
  const longshot = rockFinds.filter((r) => r.chance === "longshot");

  return `
    <article class="spot-card ${done ? "checked" : ""}" data-spot="${id}">
      <div class="spot-mission-badge">${m.emoji || "🪨"} Mission</div>
      <h4>${escapeHtml(s.name)} ${done ? "✅" : ""}</h4>
      <p class="muted small">${escapeHtml(s.area)} · ${escapeHtml(s.driveLabel || formatDistance(s.distanceKm))}</p>
      <p class="spot-mission-title">${escapeHtml(m.title || "Rock Hunt Mission")}</p>
      <p class="spot-mission-hook">${escapeHtml(m.hook || s.why || "")}</p>

      <div class="spot-rock-hunt">
        <div class="spot-rock-hunt-label">🪨 What to hunt here</div>
        ${
          rockFinds.length
            ? `<div class="rock-chip-row">
                ${rockFinds
                  .map(
                    (r) =>
                      `<span class="rock-chip ${r.chanceClass || ""} rarity-${r.rarity || "common"}" title="${escapeAttr(r.look || r.hint || "")}">
                        ${r.chanceEmoji || ""} ${escapeHtml(r.name)}
                        <em>${escapeHtml(r.chanceShort || "")}</em>
                      </span>`
                  )
                  .join("")}
              </div>`
            : ""
        }
        <p class="spot-look-for"><strong>Look for:</strong> ${escapeHtml(m.lookFor || "Colors, textures, and shiny bits!")}</p>
        ${
          m.rarityTease
            ? `<p class="spot-rarity-tease">✨ ${escapeHtml(m.rarityTease)}</p>`
            : ""
        }
        <ul class="spot-rock-hints">
          ${likely
            .map(
              (r) =>
                `<li class="find-likely"><span class="find-tag">Likely</span> <strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.look)}</li>`
            )
            .join("")}
          ${lucky
            .map(
              (r) =>
                `<li class="find-lucky"><span class="find-tag">Lucky</span> <strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.look)}</li>`
            )
            .join("")}
          ${longshot
            .map(
              (r) =>
                `<li class="find-longshot"><span class="find-tag">Longshot</span> <strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.look)}</li>`
            )
            .join("")}
        </ul>
        ${
          m.collectorHook
            ? `<p class="spot-collector-hook">🏆 ${escapeHtml(m.collectorHook)}</p>`
            : ""
        }
      </div>

      <div class="spot-mini-challenge">
        <strong>🎯 Mini challenge</strong>
        <p>${escapeHtml(m.miniChallenge || "Find a rock + take the special photo for bonus XP!")}</p>
      </div>

      <div class="spot-challenge ${chDone ? "done" : nearEnough ? "near" : ""}">
        <span class="spot-challenge-emoji">${chDone ? "✅" : ch.emoji || "🎯"}</span>
        <div>
          <strong>Photo challenge: ${escapeHtml(ch.title || "Highlight")}</strong>
          <p>${escapeHtml(ch.prompt)}</p>
          ${
            chDone
              ? `<em class="muted">Challenge complete!</em>`
              : nearEnough
                ? `<button type="button" class="btn btn-secondary btn-sm" data-challenge-snap="${escapeAttr(id)}">📸 Snap it for +XP</button>`
                : `<em class="muted">Get close to unlock snap + XP</em>`
          }
        </div>
      </div>
      <p class="tip">🛡️ ${escapeHtml(s.tips)}</p>
      ${
        done
          ? `<p class="checkin-done">Checked in — nice adventure!</p>`
          : `<button type="button" class="btn btn-primary btn-checkin" data-checkin="${id}"
              data-name="${escapeAttr(s.name)}"
              data-generic="${s.generic ? "1" : "0"}"
              data-lat="${s.lat ?? ""}"
              data-lng="${s.lng ?? ""}"
            >${gate.ok ? "📍 I'm here — Check in!" : "📍 Check in (need to be closer)"}</button>
            ${!gate.ok && loc ? `<p class="muted small">${escapeHtml(gate.reason || "")}</p>` : ""}`
      }
    </article>`;
}

function renderAdventureAlbumDetail(album) {
  const photos = album.photos || [];
  return `
    <section class="screen explore-screen">
      <header class="screen-header">
        <button type="button" class="btn btn-secondary" id="btn-back-albums">← All adventures</button>
        <h1 style="margin-top:0.75rem">${escapeHtml(album.title || "Adventure")}</h1>
        <p>${escapeHtml(album.subtitle || "")} · ${photos.length} photo${photos.length === 1 ? "" : "s"}</p>
      </header>
      <div class="card">
        <p class="muted small">Memory album for this outing. Add more photos while you’re still here!</p>
        <button type="button" class="btn btn-primary btn-full" id="btn-adv-photo" style="margin:0.65rem 0">
          📸 Add photo to this adventure
        </button>
        <p class="muted small">Opens your phone camera — quick snap for the album!</p>
        <button type="button" class="btn btn-secondary btn-full" id="btn-rename-album">✏️ Rename album</button>
      </div>
      ${
        photos.length
          ? `<div class="adv-grid">
              ${photos
                .map(
                  (p) => `
                <figure class="adv-card">
                  <img src="${p.dataUrl}" alt="" />
                  <figcaption>
                    ${p.placeLabel ? `<strong>${escapeHtml(p.placeLabel)}</strong>` : ""}
                    <button type="button" class="btn-ghost-sm" data-del-adv="${p.id}">Remove photo</button>
                  </figcaption>
                </figure>`
                )
                .join("")}
            </div>`
          : `<div class="empty-card"><p>No photos in this album yet.</p></div>`
      }
      <button type="button" class="btn btn-ghost btn-full" id="btn-del-album" style="margin-top:1rem;color:var(--danger)">Delete whole adventure</button>
      ${renderAdventureCameraOverlay()}
    </section>
  `;
}

function findSpotById(id) {
  if (!id) return null;
  return PUBLIC_SPOTS.find((s) => s.id === id) || null;
}

/** Full-screen phone camera for adventure album snaps (not a desktop file picker). */
function renderAdventureCameraOverlay() {
  if (!state.adventureCamOpen) return "";
  let challengeHint = "Point at the scenery, trail, or family!";
  let header = "📸 Adventure photo";
  if (state.challengeSpotId) {
    const chSpot = findSpotById(state.challengeSpotId);
    if (chSpot) {
      const ch = getPhotoChallenge(chSpot);
      header = `${ch.emoji || "🎯"} ${ch.title || "Photo challenge"}`;
      challengeHint = ch.prompt || challengeHint;
    }
  }
  return `
    <div class="adv-cam-overlay" id="adv-cam-overlay" role="dialog" aria-label="Take adventure photo">
      <div class="adv-cam-sheet">
        <header class="adv-cam-header">
          <h2>${escapeHtml(header)}</h2>
          <button type="button" class="btn btn-ghost" id="btn-adv-cam-close" aria-label="Close">✕</button>
        </header>
        ${
          state.challengeSpotId
            ? `<p class="adv-cam-challenge-prompt">${escapeHtml(challengeHint)}</p>`
            : ""
        }
        <div class="adv-cam-viewfinder">
          <video id="adv-cam-video" playsinline autoplay muted></video>
          <div class="adv-cam-hint">${escapeHtml(challengeHint)}</div>
        </div>
        <div class="adv-cam-actions">
          <button type="button" class="btn btn-primary btn-xl btn-full" id="btn-adv-snap">📷 Snap photo!</button>
          <label class="btn btn-secondary btn-full file-btn">
            🖼️ From gallery instead
            <input type="file" id="adv-photo-input" accept="image/*" capture="environment" hidden />
          </label>
          <button type="button" class="btn btn-ghost btn-full" id="btn-adv-cam-cancel">Cancel</button>
        </div>
      </div>
    </div>`;
}

async function renderPath() {
  const xp = await getXp();
  const { current, next, progress } = levelFromXp(xp);
  const earned = await getBadgesEarned();
  const list = allBadgesWithStatus(earned);
  const side = list.filter((b) => b.path === "side");
  const main = list.filter((b) => b.path === "main");

  return `
    <section class="screen path-screen">
      <header class="screen-header">
        <h1>Adventure Path</h1>
        <p>30 ranks from Pebble Scout to Eternal Earthkeeper — a long quest!</p>
      </header>
      ${renderLevelBar(xp)}
      <p class="muted small center path-you-are">
        You are <strong>Level ${current.level}: ${escapeHtml(current.title)}</strong>
        ${next ? ` · Next: ${escapeHtml(next.title)} (${Math.round(progress * 100)}%)` : " · Path complete! 🌌"}
      </p>

      <h2 class="section-title">Your journey</h2>
      <div class="level-path" role="list">
        ${LEVELS.map((L) => {
          const done = xp >= L.xp;
          const here = L.level === current.level;
          return `
            <div class="level-step ${done ? "done" : ""} ${here ? "here" : ""}" role="listitem">
              <div class="level-node">${L.emoji}</div>
              <div class="level-meta">
                <strong>Level ${L.level}</strong>
                <span>${escapeHtml(L.title)}</span>
                <em>${L.xp} XP</em>
              </div>
              ${here ? `<span class="you-pin">YOU</span>` : done ? `<span class="done-pin">✓</span>` : ""}
            </div>`;
        }).join("")}
      </div>

      <h2 class="section-title">Path badges</h2>
      <div class="badge-grid">${main.map(badgeCard).join("")}</div>
      <h2 class="section-title">Side quests</h2>
      <div class="badge-grid">${side.map(badgeCard).join("")}</div>
      <p class="muted small center">Badges ${earned.length} / ${BADGES.length} · Keep exploring!</p>
    </section>
  `;
}

function badgeCard(b) {
  return `
    <article class="badge-card ${b.unlocked ? "unlocked" : "locked"}">
      <div class="badge-emoji">${b.unlocked ? b.emoji : "🔒"}</div>
      <h3>${escapeHtml(b.name)}</h3>
      <p>${escapeHtml(b.description)}</p>
    </article>`;
}

function bindScreen() {
  app.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.go));
  });
  // Photo challenge CTAs work on Home + Explore
  app.querySelectorAll("[data-challenge-snap]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.challengeSnap;
      openAdventureCamera({ challengeSpotId: id });
      // Stay on current route; re-render overlay
      if (state.route === "home" || state.route === "explore") {
        await render();
      } else {
        state.route = "explore";
        setActiveNav("explore");
        await render();
      }
    });
  });
  if (state.route === "identify") bindIdentify();
  if (state.route === "dex") bindDex();
  if (state.route === "explore") bindExplore();
  if (state.route === "home") bindHome();
  // path has no extra binds
}

function bindHome() {
  // Start camera if overlay opened from home challenge CTA
  if (state.adventureCamOpen) {
    startAdventureCamera();
    bindAdventureCameraControls();
  }
}

function bindIdentify() {
  const fileInput = $("#file-input");
  $("#btn-start-cam")?.addEventListener("click", async () => {
    try {
      stopCamera();
      state.photoDataUrl = null;
      state.lastResult = null;
      await render();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      state.stream = stream;
      const v = $("#cam-video");
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      const snap = $("#btn-snap");
      if (snap) snap.disabled = false;
      toast("Camera ready!", "success");
    } catch {
      toast("Camera blocked — try Gallery upload instead.", "error");
    }
  });

  $("#btn-snap")?.addEventListener("click", async () => {
    const v = $("#cam-video");
    if (!v || !v.videoWidth) {
      toast("Start the camera first", "error");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    // Smaller JPEG for faster Netlify/xAI identify
    state.photoDataUrl = canvas.toDataURL("image/jpeg", 0.72);
    stopCamera();
    state.lastResult = null;
    await render();
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      stopCamera();
      state.photoDataUrl = await fileToDataUrl(file, 960, 0.72);
      state.lastResult = null;
      await render();
    } catch {
      toast("Could not read that image", "error");
    }
  });

  $("#btn-clear-photo")?.addEventListener("click", async () => {
    state.photoDataUrl = null;
    state.lastResult = null;
    await render();
  });

  $("#id-outdoor-check")?.addEventListener("change", (e) => {
    state.foundOutside = !!e.target.checked;
    if (!state.foundOutside) state.outdoorLocation = null;
  });

  $("#btn-identify")?.addEventListener("click", runIdentify);
  $("#btn-save-key")?.addEventListener("click", async () => {
    const key = $("#api-key-input")?.value?.trim();
    if (!key) {
      toast("Paste your XAI_API_KEY first", "error");
      return;
    }
    try {
      await saveApiKey(key);
      state.visionStatus = await getVisionStatus(true);
      toast("Vision key saved! Try Identify again.", "success");
      await render();
    } catch (e) {
      toast(e.message || "Could not save key", "error");
    }
  });
  bindResultActions();
}

function bindResultActions() {
  $("#btn-collect")?.addEventListener("click", () => collectCandidate(0));
  app.querySelectorAll(".btn-collect-alt").forEach((b) => {
    b.addEventListener("click", () => collectCandidate(Number(b.dataset.idx)));
  });
  bindFieldTestsLive();
}

/** Interactive Yes/No only during identify (or Dex edit mode via modal hosts). */
function bindFieldTestsLive(root = app) {
  root.querySelectorAll("[data-field-host]").forEach((host) => {
    const idx = Number(host.dataset.idx);
    const findId = host.dataset.findId || null;
    host.querySelectorAll(".btn-yn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const testId = btn.dataset.test;
        const answer = btn.dataset.answer;
        if (findId) {
          await answerFieldTestOnFind(findId, testId, answer, { reopenEdit: true });
          return;
        }
        if (!state.lastResult?.candidates?.[idx]) return;
        const c = state.lastResult.candidates[idx];
        c.fieldAnswers = { ...(c.fieldAnswers || {}), [testId]: answer };
        c.confidence = adjustedConfidence(
          c.baseConfidence ?? c.confidence,
          c.fieldTests,
          c.fieldAnswers
        );
        const card = host.closest(".candidate-card");
        const confEl = card?.querySelector("[data-conf-display]");
        if (confEl) confEl.textContent = conf(c.confidence);
        host.querySelectorAll(`[data-test="${testId}"]`).forEach((b) => {
          b.classList.toggle("on", b.dataset.answer === answer);
          b.classList.toggle("yes", b.dataset.answer === "yes" && b.classList.contains("on"));
          b.classList.toggle("no", b.dataset.answer === "no" && b.classList.contains("on"));
        });
        host.querySelector(`[data-test-id="${testId}"]`)?.classList.add("answered");

        if (testsComplete(c.fieldTests, c.fieldAnswers) && !state.fieldXpAwarded.has(idx)) {
          state.fieldXpAwarded.add(idx);
          await grantFieldTestXp();
          toast("Field tests complete — confidence updated! +XP", "success");
          await evaluateBadges({ celebrate: true });
        }
      });
    });
  });
}

async function answerFieldTestOnFind(findId, testId, answer, { reopenEdit = false } = {}) {
  const f = await getFind(findId);
  if (!f) return;
  const fieldAnswers = { ...(f.fieldAnswers || {}), [testId]: answer };
  const confVal = adjustedConfidence(f.baseConfidence ?? f.confidence, f.fieldTests, fieldAnswers);
  const wasComplete = testsComplete(f.fieldTests, f.fieldAnswers || {});
  const nowComplete = testsComplete(f.fieldTests, fieldAnswers);
  const patch = { fieldAnswers, confidence: confVal };
  // Only award field-test XP once per find
  if (nowComplete && !wasComplete && !f.fieldTestsXpAwarded) {
    patch.fieldTestsXpAwarded = true;
    await updateFind(findId, patch);
    await grantFieldTestXp();
    toast("Field tests updated! +XP", "success");
    await evaluateBadges({ celebrate: true });
  } else {
    await updateFind(findId, patch);
  }
  document.querySelector(".modal-backdrop")?.remove();
  openFindDetail(findId, { editTests: reopenEdit });
}

async function runIdentify() {
  if (!state.photoDataUrl) return;
  const status = $("#identify-status");
  const results = $("#identify-results");
  status.classList.remove("hidden");
  status.innerHTML = `<div class="spinner"></div><p>Asking the vision model to study your rock…</p>`;
  results.innerHTML = "";
  $("#btn-identify").disabled = true;

  try {
    // Refresh vision status (key may have been added)
    state.visionStatus = await getVisionStatus(true);
    if (!state.visionStatus?.vision) {
      status.innerHTML = `
        <div class="setup-error card">
          <h3>🔭 Real vision isn’t configured yet</h3>
          <p>Rock Quest Oahu needs an <strong>xAI API key</strong> to identify rocks from photos. We don’t fake IDs anymore (that caused the same 3 rocks every time).</p>
          <ol class="setup-steps">
            <li>Get a key at <a href="https://console.x.ai" target="_blank" rel="noopener">console.x.ai</a></li>
            <li><strong>Live site:</strong> Netlify → Environment variables → <code>XAI_API_KEY</code> → Redeploy</li>
            <li><strong>Local Mac:</strong> paste in the box above, or put it in <code>.env</code> and run <code>python3 server.py</code></li>
          </ol>
        </div>`;
      toast("Add XAI_API_KEY for real rock IDs", "error");
      return;
    }

    // Soft geo prior only when "found outside" is checked
    let locationPayload = null;
    if (state.foundOutside) {
      status.innerHTML = `<div class="spinner"></div><p>Getting adventure location, then studying your rock…</p>`;
      try {
        const pos = await getPosition(10000);
        state.location = pos;
        const geo = await reverseGeocode(pos.lat, pos.lng);
        state.outdoorLocation = {
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy ?? null,
          placeName: geo?.placeName || "",
          label: geo?.label || formatCoords(pos.lat, pos.lng),
        };
        locationPayload = state.outdoorLocation;
      } catch {
        toast("Couldn't get location — identifying from the photo only.", "info");
        state.outdoorLocation = null;
      }
      status.innerHTML = `<div class="spinner"></div><p>Asking the vision model to study your rock…</p>`;
    } else {
      state.outdoorLocation = null;
    }

    const result = await identifyRock(state.photoDataUrl, {
      foundOutside: state.foundOutside,
      location: locationPayload,
    });
    state.lastResult = result;
    state.fieldXpAwarded = new Set();
    await bumpIdentifyCount();

    const top = result.candidates[0];
    const { isNew } = await markSeen(top.rockId, top);
    await grantIdentifyXp({ isNewType: isNew });

    status.classList.add("hidden");
    results.innerHTML = renderResult(result);
    bindResultActions();

    if (isNew) {
      const banner = $("#new-banner");
      banner?.classList.remove("hidden");
      sparkleBurst($("#results-block") || document.body);
      toast(`✨ Looks like ${top.name}!`, "success");
      setTimeout(() => banner?.classList.add("hidden"), 3500);
    } else {
      toast(`Identified: ${top.name}`, "info");
    }

    await evaluateBadges({ celebrate: true });
  } catch (e) {
    console.error(e);
    if (e.code === "needs_key") {
      clearVisionStatusCache();
      state.visionStatus = await getVisionStatus(true);
      status.innerHTML = `
        <div class="setup-error card">
          <h3>API key needed</h3>
          <p>${escapeHtml(e.message)}</p>
          <p class="muted small">Use the setup box above to paste your key from console.x.ai</p>
        </div>`;
    } else {
      status.innerHTML = `
        <div class="setup-error card">
          <h3>Identification failed</h3>
          <p class="error-text">${escapeHtml(e.message)}</p>
          <p class="muted small">Tips: brighter photo, fill the frame with the rock, check API credits at console.x.ai</p>
        </div>`;
    }
    toast(e.message, "error");
  } finally {
    const btn = $("#btn-identify");
    if (btn) btn.disabled = false;
  }
}

async function collectCandidate(idx) {
  const c = state.lastResult?.candidates?.[idx];
  if (!c || !state.photoDataUrl) return;

  showModal(`
    <h2>Save to Rock Dex</h2>
    <p class="muted">Nickname optional — you can favorite anytime later!</p>
    <label class="field-label">Nickname</label>
    <input class="text-input" id="nick-input" placeholder="e.g. Lava Buddy" maxlength="40" />
    <label class="field-label">Notes</label>
    <textarea class="text-input" id="notes-input" placeholder="Any adventure notes?" rows="2"></textarea>
    <label class="check-row"><input type="checkbox" id="outdoor-input" ${state.foundOutside ? "checked" : ""} /> 🌞 Found outside / on an adventure</label>
    <p class="muted small" id="outdoor-hint">Saves the adventure spot on a map when possible. (Identify already used a gentle location hint if this was checked.)</p>
    <label class="check-row"><input type="checkbox" id="fav-input" /> ⭐ Mark as favorite</label>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-close type="button">Cancel</button>
      <button class="btn btn-primary" id="confirm-save" type="button">Save!</button>
    </div>
  `);

  $("#confirm-save")?.addEventListener("click", async () => {
    const nickname = $("#nick-input")?.value?.trim() || "";
    const notes = $("#notes-input")?.value?.trim() || "";
    const favorite = !!$("#fav-input")?.checked;
    const foundOutside = !!$("#outdoor-input")?.checked;
    const finds = await getAllFinds();
    const isNewType = !finds.some((f) => f.rockId === c.rockId);

    let foundLocation = null;
    if (foundOutside) {
      // Prefer location captured at identify-time; refresh if missing
      if (state.outdoorLocation?.lat != null) {
        foundLocation = { ...state.outdoorLocation };
      } else {
        try {
          const pos = await getPosition(10000);
          state.location = pos;
          const geo = await reverseGeocode(pos.lat, pos.lng);
          foundLocation = {
            lat: pos.lat,
            lng: pos.lng,
            accuracy: pos.accuracy ?? null,
            placeName: geo?.placeName || "",
            label: geo?.label || formatCoords(pos.lat, pos.lng),
          };
        } catch {
          toast("Couldn't pin location — rock still saved!", "info");
        }
      }
    }

    await addFind({
      rockId: c.rockId,
      name: c.name,
      rarity: c.rarity,
      nickname,
      notes,
      favorite,
      photoDataUrl: state.photoDataUrl,
      confidence: c.confidence,
      baseConfidence: c.baseConfidence ?? c.confidence,
      properties: c.properties,
      facts: c.facts,
      fieldTests: c.fieldTests,
      fieldAnswers: c.fieldAnswers || {},
      valueNote: c.valueNote,
      summary: state.lastResult?.summary || "",
      demo: !!state.lastResult?.demo,
      foundOutside,
      foundLocation,
    });

    if (nickname || notes) await setFlag("hasNotes", true);
    await grantCollectXp({
      isNewType,
      rarity: c.rarity,
      outdoor: !!(foundOutside && foundLocation),
    });
    document.querySelector(".modal-backdrop")?.remove();
    toast(
      foundLocation
        ? `Saved with adventure spot: ${foundLocation.placeName || foundLocation.label}!`
        : "Saved to your Rock Dex! 📘",
      "success"
    );
    sparkleBurst(document.body);
    await evaluateBadges({ celebrate: true });
  });
}

function bindDex() {
  app.querySelectorAll("[data-filter]").forEach((b) => {
    b.addEventListener("click", async () => {
      state.dexFilter = b.dataset.filter;
      await render();
    });
  });
  app.querySelectorAll("[data-view]").forEach((b) => {
    b.addEventListener("click", async () => {
      state.dexView = b.dataset.view;
      await render();
    });
  });
  app.querySelectorAll("[data-find]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      openFindDetail(b.dataset.find);
    });
  });
  app.querySelectorAll("[data-fav]").forEach((b) => {
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = b.dataset.fav;
      const f = await getFind(id);
      if (!f) return;
      await updateFind(id, { favorite: !f.favorite });
      toast(f.favorite ? "Removed from favorites" : "⭐ Added to Showcase!", "success");
      await evaluateBadges({ celebrate: true });
      await render();
    });
  });
}

function foundLocationHtml(f) {
  if (!f.foundOutside) {
    return `<div class="found-box indoor"><strong>🏠 Indoor / not marked outdoor</strong><p class="muted small">No adventure map for this one.</p></div>`;
  }
  const loc = f.foundLocation;
  if (!loc || loc.lat == null || loc.lng == null) {
    return `<div class="found-box"><strong>🌞 Found outside</strong><p class="muted small">Location wasn’t available when you saved it.</p></div>`;
  }
  const title = loc.placeName || loc.label || "Adventure spot";
  const embed = osmEmbedUrl(loc.lat, loc.lng);
  const link = osmLink(loc.lat, loc.lng);
  return `
    <div class="found-box outdoor">
      <strong>🌞 Found outside</strong>
      <p class="place-title">${escapeHtml(title)}</p>
      <p class="muted small">${escapeHtml(loc.label || formatCoords(loc.lat, loc.lng))}</p>
      <div class="mini-map-wrap">
        <iframe class="mini-map" title="Find location map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
          src="${embed}"></iframe>
      </div>
      <a class="map-link" href="${link}" target="_blank" rel="noopener">Open in OpenStreetMap</a>
    </div>`;
}

async function openFindDetail(id, { editTests = false } = {}) {
  const f = await getFind(id);
  if (!f) return;
  const asCandidate = {
    name: f.name,
    rockId: f.rockId,
    rarity: f.rarity,
    confidence: f.confidence,
    baseConfidence: f.baseConfidence ?? f.confidence,
    properties: f.properties || {},
    facts: f.facts || [],
    fieldTests: f.fieldTests || [],
    fieldAnswers: f.fieldAnswers || {},
    valueNote: f.valueNote || "",
  };

  showModal(`
    <div class="find-detail">
      ${f.photoDataUrl ? `<img class="detail-photo" src="${f.photoDataUrl}" alt="" />` : ""}
      <h2>${escapeHtml(f.nickname || f.name)}</h2>
      ${f.summary ? `<p class="muted">${escapeHtml(f.summary)}</p>` : ""}
      ${foundLocationHtml(f)}
      ${renderCandidateCard(asCandidate, 0, {
        phase: "dex",
        interactiveTests: editTests,
        findId: f.id,
      })}
      ${
        (f.fieldTests || []).length
          ? editTests
            ? `<button type="button" class="btn btn-secondary btn-full" id="lock-field-tests">🔒 Done editing field tests</button>`
            : `<button type="button" class="btn btn-secondary btn-full" id="edit-field-tests">✏️ Edit field tests</button>`
          : ""
      }
      <label class="field-label">Nickname</label>
      <input class="text-input" id="edit-nick" value="${escapeAttr(f.nickname || "")}" />
      <label class="field-label">Notes</label>
      <textarea class="text-input" id="edit-notes" rows="3">${escapeHtml(f.notes || "")}</textarea>
      <label class="check-row"><input type="checkbox" id="edit-fav" ${f.favorite ? "checked" : ""}/> ⭐ Favorite / Showcase</label>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close type="button">Close</button>
        <button class="btn btn-primary" id="save-find" type="button">Save changes</button>
      </div>
    </div>
  `);

  const modal = document.querySelector(".modal-card");
  if (editTests && modal) {
    bindFieldTestsLive(modal);
  }

  $("#edit-field-tests")?.addEventListener("click", () => {
    document.querySelector(".modal-backdrop")?.remove();
    openFindDetail(id, { editTests: true });
  });

  $("#lock-field-tests")?.addEventListener("click", async () => {
    const latest = await getFind(id);
    if (latest) {
      const confVal = adjustedConfidence(
        latest.baseConfidence ?? latest.confidence,
        latest.fieldTests,
        latest.fieldAnswers || {}
      );
      await updateFind(id, { confidence: confVal });
    }
    document.querySelector(".modal-backdrop")?.remove();
    toast("Field tests locked again", "success");
    openFindDetail(id, { editTests: false });
  });

  $("#save-find")?.addEventListener("click", async () => {
    const nickname = $("#edit-nick")?.value?.trim() || "";
    const notes = $("#edit-notes")?.value?.trim() || "";
    const favorite = !!$("#edit-fav")?.checked;
    const latest = await getFind(id);
    const confVal = latest
      ? adjustedConfidence(
          latest.baseConfidence ?? latest.confidence,
          latest.fieldTests,
          latest.fieldAnswers || {}
        )
      : undefined;
    await updateFind(id, {
      nickname,
      notes,
      favorite,
      ...(confVal != null ? { confidence: confVal } : {}),
    });
    if (nickname || notes) await setFlag("hasNotes", true);
    document.querySelector(".modal-backdrop")?.remove();
    toast("Updated!", "success");
    await evaluateBadges({ celebrate: true });
    await render();
  });
}

/** Open rear-facing camera for adventure album snaps. */
async function startAdventureCamera() {
  const v = $("#adv-cam-video");
  if (!v) return;
  try {
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    state.stream = stream;
    v.srcObject = stream;
    await v.play();
    toast("Camera ready — snap the adventure!", "success");
  } catch (err) {
    console.warn("Adventure camera failed", err);
    // Keep overlay open so kids can use gallery fallback
    toast("Camera needs permission — or pick From gallery.", "error");
  }
}

/** Save a snapped/chosen adventure photo into today's (or open) album. */
async function saveAdventurePhotoFromDataUrl(dataUrl) {
  let placeLabel = "";
  let lat = null;
  let lng = null;
  const openId = state.adventureAlbumId;
  const openAlbum = openId ? await getAdventureAlbum(openId) : null;
  const challengeId = state.challengeSpotId;
  try {
    const pos = await getPosition(8000);
    state.location = pos;
    lat = pos.lat;
    lng = pos.lng;
    const geo = await reverseGeocode(pos.lat, pos.lng);
    placeLabel = openAlbum?.placeLabel || geo?.placeName || geo?.label || "";
  } catch {
    placeLabel = openAlbum?.placeLabel || "";
  }

  // If challenge was targeted, prefer that place name for the album
  const challengeSpot = challengeId ? findSpotById(challengeId) : null;
  if (challengeSpot) {
    placeLabel = challengeSpot.name || placeLabel;
  }

  const { album } = await addAdventurePhoto({
    dataUrl,
    note: challengeSpot ? getPhotoChallenge(challengeSpot).title : "",
    lat,
    lng,
    placeLabel: placeLabel || openAlbum?.placeLabel || "Adventure",
    dateKey: openAlbum?.dateKey,
  });
  state.adventureAlbumId = album?.id || state.adventureAlbumId;
  await grantAdventurePhotoXp();

  // Complete location photo challenge if on-site (or explicitly started from challenge CTA)
  const challengeResult = await maybeCompletePhotoChallenge({
    preferredSpotId: challengeId,
    lat,
    lng,
  });

  if (challengeResult?.isNew) {
    toast(`🎯 Challenge complete! +XP · Saved to “${album?.title || "Adventure"}”`, "success");
  } else {
    toast(`Saved to “${album?.title || "Adventure"}” 📸`, "success");
  }
  sparkleBurst(document.body);
  state.challengeSpotId = null;
  await evaluateBadges({ celebrate: true });
  await render();
}

/**
 * If user is near a spot (or targeted a challenge), mark challenge complete + XP once.
 */
async function maybeCompletePhotoChallenge({ preferredSpotId = null, lat = null, lng = null } = {}) {
  const loc =
    lat != null && lng != null
      ? { lat, lng }
      : state.location;
  if (!loc) return null;

  const completedMap = await getPhotoChallengesCompleted();
  const completedIds = new Set(Object.keys(completedMap));
  const near = getNearbyChallengeSpots(loc, { completedIds });

  let target = preferredSpotId
    ? near.find((s) => s.id === preferredSpotId) || findSpotById(preferredSpotId)
    : null;

  // If preferred spot isn't near, only complete when GPS says we're close
  if (preferredSpotId && target) {
    const d =
      target.distanceKm != null
        ? target.distanceKm
        : target.lat != null
          ? // recompute via near list only
            near.find((s) => s.id === preferredSpotId)?.distanceKm
          : null;
    if (d == null || !near.some((s) => s.id === preferredSpotId)) {
      // Explicit challenge CTA but not near — still save photo, no challenge XP
      toast("Photo saved! Get closer to the place to finish the challenge.", "info");
      return { isNew: false };
    }
  }

  if (!target) {
    target = near.find((s) => !s.challengeDone) || null;
  }
  if (!target || completedIds.has(target.id)) return { isNew: false };

  // Must be within challenge radius
  if (!near.some((s) => s.id === target.id)) return { isNew: false };

  const ch = getPhotoChallenge(target);
  const { isNew } = await completePhotoChallenge({
    spotId: target.id,
    name: target.name,
    title: ch.title,
    lat: loc.lat,
    lng: loc.lng,
  });
  if (isNew) {
    await grantPhotoChallengeXp();
  }
  return { isNew, spot: target };
}

function bindExplore() {
  $("#btn-locate")?.addEventListener("click", async () => {
    try {
      state.location = await getPosition();
      state.spotShowCount = SPOTS_PAGE_SIZE;
      toast("Location locked in!", "success");
      await render();
    } catch {
      toast("Couldn't get location. You can still browse general tips!", "error");
    }
  });

  // Range only filters — NO xp / badges; reset place pagination
  app.querySelectorAll("[data-range]").forEach((b) => {
    b.addEventListener("click", async () => {
      state.range = b.dataset.range;
      state.spotShowCount = SPOTS_PAGE_SIZE;
      await render();
    });
  });

  $("#btn-show-more-spots")?.addEventListener("click", async () => {
    state.spotShowCount = (state.spotShowCount || SPOTS_PAGE_SIZE) + SPOTS_PAGE_SIZE;
    await render({ preserveScroll: true });
  });

  // Infinite scroll: load more when sentinel nears the viewport
  const sentinel = document.getElementById("spot-scroll-sentinel");
  if (sentinel && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        state.spotShowCount = (state.spotShowCount || SPOTS_PAGE_SIZE) + SPOTS_PAGE_SIZE;
        render({ preserveScroll: true });
      },
      { root: null, rootMargin: "160px", threshold: 0.01 }
    );
    io.observe(sentinel);
  }

  $("#btn-back-albums")?.addEventListener("click", async () => {
    state.adventureAlbumId = null;
    closeAdventureCamera();
    await render();
  });

  app.querySelectorAll("[data-open-album]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.adventureAlbumId = btn.dataset.openAlbum;
      closeAdventureCamera();
      await render();
    });
  });

  $("#btn-rename-album")?.addEventListener("click", async () => {
    const id = state.adventureAlbumId;
    if (!id) return;
    const next = window.prompt("Name this adventure (e.g. Kailua Beach Saturday)", "");
    if (next == null || !next.trim()) return;
    await renameAdventureAlbum(id, next.trim());
    toast("Album renamed!", "success");
    await render();
  });

  $("#btn-del-album")?.addEventListener("click", async () => {
    if (!state.adventureAlbumId) return;
    if (!window.confirm("Delete this whole adventure album?")) return;
    await deleteAdventureAlbum(state.adventureAlbumId);
    state.adventureAlbumId = null;
    toast("Adventure deleted", "info");
    await render();
  });

  // Phone-first adventure camera: open overlay + live rear camera
  $("#btn-adv-photo")?.addEventListener("click", async () => {
    // If near an incomplete challenge, auto-target it
    let challengeSpotId = null;
    if (state.location) {
      const completed = await getPhotoChallengesCompleted();
      const active = getActivePhotoChallenge(state.location, new Set(Object.keys(completed)));
      if (active && !active.challengeDone) challengeSpotId = active.id;
    }
    openAdventureCamera({ challengeSpotId });
    await render();
  });

  bindAdventureCameraControls();

  // Start live camera when overlay is open
  if (state.adventureCamOpen) {
    startAdventureCamera();
  }

  app.querySelectorAll("[data-del-adv]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteAdventurePhoto(btn.dataset.delAdv);
      toast("Photo removed", "info");
      // if album empty, go back to list
      if (state.adventureAlbumId) {
        const a = await getAdventureAlbum(state.adventureAlbumId);
        if (!a || !(a.photos || []).length) state.adventureAlbumId = null;
      }
      await render();
    });
  });

  app.querySelectorAll("[data-checkin]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.location) {
        toast("Turn on location first, then come back!", "error");
        return;
      }
      const spot = {
        id: btn.dataset.checkin,
        spotId: btn.dataset.checkin,
        name: btn.dataset.name,
        generic: btn.dataset.generic === "1",
        lat: btn.dataset.lat ? Number(btn.dataset.lat) : null,
        lng: btn.dataset.lng ? Number(btn.dataset.lng) : null,
      };
      try {
        state.location = await getPosition(8000);
      } catch {
        /* keep previous */
      }
      const gate = canCheckInAt(spot, state.location);
      if (!gate.ok) {
        toast(gate.reason || "Get closer to check in!", "error");
        return;
      }
      const { isNewSpot } = await addCheckIn({
        spotId: spot.spotId,
        name: spot.name,
        lat: state.location.lat,
        lng: state.location.lng,
      });
      await grantCheckInXp({ isNewSpot });
      sparkleBurst(btn);
      toast(isNewSpot ? "📍 Checked in! +XP" : "📍 Checked in again! +XP", "success");
      await evaluateBadges({ celebrate: true });
      await render();
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

document.querySelectorAll(".nav-item").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(a.dataset.route);
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

navigate("home");
