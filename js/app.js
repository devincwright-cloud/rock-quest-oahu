import {
  addAdventurePhoto,
  addCheckIn,
  addFind,
  addPendingIdentify,
  bumpIdentifyCount,
  completePhotoChallenge,
  deleteAdventureAlbum,
  deleteAdventurePhoto,
  deleteFind,
  getAdventureAlbum,
  getAdventureAlbums,
  getAdventurePhotos,
  getAllFinds,
  getPendingIdentifies,
  getPhotoChallengesCompleted,
  removePendingIdentify,
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
import {
  clearVisionStatusCache,
  compressForUpload,
  fileToDataUrl,
  getVisionStatus,
  identifyRock,
  saveApiKey,
  verifyChallengePhoto,
} from "./identify.js";
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
  watchPosition,
  clearWatch,
  PUBLIC_SPOTS,
  SPOTS_PAGE_SIZE,
  suggestRocks,
  suggestSpots,
} from "./explore.js";
import {
  loadLastLocation,
  openCameraStream,
  applyZoom,
  getZoomRange,
  wasLocationGrantedBefore,
  markCameraGranted,
  queryPermission,
} from "./permissions.js";
import { shareOrSavePhoto, shareOrSaveAlbum } from "./share.js";
import { formatCoords, osmEmbedUrl, osmLink, reverseGeocode } from "./geo.js";
import { adjustedConfidence, formatAnswer, testsComplete } from "./fieldtests.js";
import { rarityBadge, setActiveNav, showModal, sparkleBurst, toast, conf, $ } from "./ui.js";
import { rarityStars } from "./data/catalog.js";
import { BADGES, LEVELS, XP_REWARDS } from "./data/badges-data.js";
import { getBadgesEarned } from "./store.js";

const ADV_SESSION_KEY = "rq_oahu_active_adventure";

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
  /** Sticky “still on this outing” even when browsing place list */
  activeAdventureId: null,
  activeAdventureTitle: "",
  /** Explore main tabs: places | history */
  exploreView: "places",
  /** Full-screen photo viewer: { photos, index, title } | null */
  photoViewer: null,
  viewerZoom: 1,
  /** Scroll Y saved when opening photo viewer (restore after close) */
  photoViewerScrollY: 0,
  /** Explore: adventure camera overlay open (phone-first snap flow) */
  adventureCamOpen: false,
  /** Spot id when camera opened for a location photo challenge */
  challengeSpotId: null,
  /** Camera: environment = rear, user = selfie */
  facingMode: "environment",
  zoom: 1,
  watchId: null,
};

const app = $("#app");

function persistActiveAdventure() {
  try {
    if (state.activeAdventureId) {
      sessionStorage.setItem(
        ADV_SESSION_KEY,
        JSON.stringify({
          id: state.activeAdventureId,
          title: state.activeAdventureTitle || "",
          at: Date.now(),
        })
      );
    } else {
      sessionStorage.removeItem(ADV_SESSION_KEY);
    }
  } catch {
    /* */
  }
}

function restoreActiveAdventure() {
  try {
    const raw = sessionStorage.getItem(ADV_SESSION_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    // Keep adventure context for a long outing day (12h)
    if (!o?.id || Date.now() - (o.at || 0) > 12 * 60 * 60 * 1000) return;
    state.activeAdventureId = o.id;
    state.activeAdventureTitle = o.title || "";
  } catch {
    /* */
  }
}

function setActiveAdventure(album) {
  if (!album?.id) return;
  state.activeAdventureId = album.id;
  state.activeAdventureTitle = album.title || "Today’s adventure";
  state.adventureAlbumId = album.id;
  persistActiveAdventure();
}

function clearActiveAdventure() {
  state.activeAdventureId = null;
  state.activeAdventureTitle = "";
  persistActiveAdventure();
}

function navigate(route) {
  state.route = route;
  setActiveNav(route);
  // Keep adventure context when switching tabs — only close live camera
  closeAdventureCamera({ clearChallenge: true });
  // If a full-screen photo is open, close it cleanly (restores safe-area)
  if (state.photoViewer) {
    closePhotoViewer();
  }
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
  // Prefer rear for scenery / challenges; selfie still available via flip
  if (!challengeSpotId && state.facingMode !== "user") {
    state.facingMode = "environment";
  }
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

  $("#btn-adv-flip")?.addEventListener("click", async () => {
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    state.zoom = 1;
    await startAdventureCamera();
  });
  $("#btn-adv-zoom-out")?.addEventListener("click", async () => {
    state.zoom = Math.max(1, (state.zoom || 1) - 0.5);
    await applyZoom(state.stream, state.zoom);
    updateZoomLabel();
  });
  $("#btn-adv-zoom-in")?.addEventListener("click", async () => {
    state.zoom = Math.min(8, (state.zoom || 1) + 0.5);
    const r = await applyZoom(state.stream, state.zoom);
    if (!r.ok && r.reason === "unsupported") {
      toast("Zoom isn’t available on this camera — move closer!", "info");
    }
    updateZoomLabel();
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
    const body = await fn();
    app.innerHTML = `${renderStickyAdventureBar()}${body}${renderPhotoViewer()}`;
    bindScreen();
    bindStickyAdventureBar();
    bindPhotoViewer();
    ensureLocationWatch();
    if (preserveScroll) {
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="screen"><div class="card"><h2>Oops!</h2><p>${escapeHtml(e.message)}</p><button class="btn btn-primary" data-go="home">Home</button></div></div>`;
    bindScreen();
  }
}

/** Keep GPS warm while exploring / on adventure (fewer “lost trail” drops). */
function ensureLocationWatch() {
  if (state.watchId != null) return;
  if (!wasLocationGrantedBefore() && !state.location) return;
  state.watchId = watchPosition(
    (loc) => {
      state.location = loc;
      // Soft refresh of near-challenge UI not forced every tick (battery)
    },
    () => {
      /* ignore watch errors; one-shot still works */
    }
  );
}

async function bootstrapLocation() {
  restoreActiveAdventure();
  const cached = loadLastLocation();
  if (cached) state.location = cached;
  const perm = await queryPermission("geolocation");
  if (perm === "granted" || wasLocationGrantedBefore()) {
    try {
      state.location = await getPosition({
        timeout: 12000,
        maximumAge: 30_000,
        highAccuracy: true,
        allowCached: true,
      });
      ensureLocationWatch();
    } catch {
      /* user may have denied later */
    }
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
          : `<p class="muted small">+${XP_REWARDS.photoChallenge || 12} XP — photo must show the real target (AI checks!)</p>
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
  const pending = await getPendingIdentifies();
  return `
    <section class="screen identify-screen">
      <header class="screen-header">
        <h1>Identify</h1>
        <p>Snap a rock — works even when signal is weak (save for later!).</p>
      </header>
      ${visionBannerHtml()}

      ${
        pending.length
          ? `<div class="card pending-id-card">
              <h3>📦 Saved for later (${pending.length})</h3>
              <p class="muted small">Photos waiting for better signal. Tap one to identify now.</p>
              <div class="pending-id-list">
                ${pending
                  .map(
                    (p) => `
                  <div class="pending-id-row">
                    <img src="${p.dataUrl}" alt="" />
                    <div>
                      <strong>Saved photo</strong>
                      <span class="muted small">${new Date(p.createdAt).toLocaleString()}</span>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm" data-pending-run="${p.id}">Identify</button>
                    <button type="button" class="btn-ghost-sm" data-pending-del="${p.id}">Remove</button>
                  </div>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }

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
        ${
          !hasPhoto
            ? `<div class="cam-toolbar">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-id-flip">${
                  state.facingMode === "user" ? "🤳 Selfie" : "📷 Rear"
                } · flip</button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-id-zoom-out">− Zoom</button>
                <span class="zoom-label" id="id-zoom-label">${(state.zoom || 1).toFixed(1)}×</span>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-id-zoom-in">Zoom +</button>
              </div>`
            : ""
        }
        <div class="camera-actions">
          <button class="btn btn-secondary" type="button" id="btn-start-cam">Open camera</button>
          <button class="btn btn-secondary" type="button" id="btn-snap" ${hasPhoto ? "" : "disabled"}>Snap</button>
          <label class="btn btn-secondary file-btn">
            Gallery
            <input type="file" id="file-input" accept="image/*" hidden />
          </label>
        </div>
        <label class="check-row outdoor-id-check">
          <input type="checkbox" id="id-outdoor-check" ${state.foundOutside ? "checked" : ""} />
          🌞 Found outside / on an adventure
        </label>
        <button class="btn btn-primary btn-xl btn-full" id="btn-identify" ${hasPhoto ? "" : "disabled"}>
          ✨ Identify this rock!
        </button>
        ${
          hasPhoto
            ? `<button class="btn btn-secondary btn-full" type="button" id="btn-share-id-photo" style="margin-top:0.5rem">
                📤 Save / Share photo
              </button>
              <button class="btn btn-secondary btn-full" type="button" id="btn-save-later" style="margin-top:0.5rem">
                📦 Save for later (weak signal)
              </button>
              <button class="btn btn-ghost btn-full" id="btn-clear-photo" type="button">Clear photo</button>`
            : ""
        }
        <p class="muted small center" style="margin-top:0.5rem">Photos are compressed automatically for slow cell service.</p>
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

/** Match adventure albums to a named spot (by spotId or place name). */
function albumsForSpot(albums, spot) {
  if (!albums?.length || !spot) return [];
  const id = spot.id || spot.spotId;
  const name = (spot.name || "").toLowerCase();
  const tokens = name
    .replace(/[()ʻ'']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !/^(the|and|park|beach|point|trail|area|public)$/i.test(t));

  return albums.filter((a) => {
    if (id && a.spotId === id) return true;
    const blob = `${a.title || ""} ${a.placeLabel || ""} ${a.subtitle || ""}`.toLowerCase();
    if (name && blob.includes(name.slice(0, Math.min(name.length, 18)))) return true;
    return tokens.some((t) => blob.includes(t));
  });
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
  const activeNear = nearChallenges.find((s) => !s.challengeDone) || null;
  const albums = await getAdventureAlbums();
  const openAlbum = state.adventureAlbumId
    ? albums.find((a) => a.id === state.adventureAlbumId) || (await getAdventureAlbum(state.adventureAlbumId))
    : null;

  if (openAlbum) {
    return renderAdventureAlbumDetail(openAlbum);
  }

  const visitedCount = allSpots.filter((s) => {
    const id = s.id;
    return checked.has(id) || completedIds.has(id) || albumsForSpot(albums, s).length > 0;
  }).length;

  const view = state.exploreView === "history" ? "history" : "places";

  return `
    <section class="screen explore-screen">
      <header class="screen-header">
        <h1>Explore</h1>
        <p>Find places · hunt rocks · browse past adventures</p>
      </header>

      <div class="explore-tabs" role="tablist">
        <button type="button" class="explore-tab ${view === "places" ? "on" : ""}" data-explore-view="places" role="tab">
          🪨 Places
        </button>
        <button type="button" class="explore-tab ${view === "history" ? "on" : ""}" data-explore-view="history" role="tab">
          📚 Past adventures${albums.length ? ` (${albums.length})` : ""}
        </button>
      </div>

      ${
        view === "history"
          ? renderPastAdventuresList(albums)
          : `
      <div class="card explore-top-card">
        <div class="explore-loc-row">
          <div>
            <strong>📍 ${loc ? "Location on" : "Location needed"}</strong>
            <p class="muted small" id="loc-status">${
              loc
                ? `Ready for drive times &amp; check-ins (±${Math.round(loc.accuracy || 0)} m)`
                : "Turn on location to see places near you"
            }</p>
          </div>
          <button class="btn btn-primary" type="button" id="btn-locate">${loc ? "Refresh" : "Use my location"}</button>
        </div>
        <div class="explore-range-row">
          <span class="muted small">How far?</span>
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
        </div>
        <p class="muted small">${escapeHtml(rocks.range.blurb)}</p>
      </div>

      ${
        activeNear
          ? renderNearChallengeCard(activeNear, { done: activeNear.challengeDone, compact: true })
          : ""
      }

      <div class="card explore-places-card">
        <div class="explore-places-head">
          <h3>🪨 Places to explore</h3>
          <p class="muted small">
            ${allSpots.length ? `${spots.length} of ${allSpots.length}` : "None in this range"}
            ${visitedCount ? ` · ✅ ${visitedCount} visited` : ""}
          </p>
        </div>
        <div class="spot-list" id="spot-list">
          ${
            spots.length
              ? spots
                  .map((s) =>
                    renderSpotCard(s, {
                      loc,
                      checked,
                      completedIds,
                      albums: albumsForSpot(albums, s),
                    })
                  )
                  .join("")
              : `<div class="empty-card">
                  <p>No places in the <strong>${escapeHtml(rocks.range.label)}</strong> band from here.</p>
                  <p class="muted small">Try Short / Medium / Longer, or turn on location.</p>
                </div>`
          }
        </div>
        ${
          remaining > 0
            ? `<div class="show-more-wrap" id="spot-show-more-wrap">
                <button type="button" class="btn btn-secondary btn-full" id="btn-show-more-spots">
                  ⬇️ Show more (${remaining} left)
                </button>
                <div id="spot-scroll-sentinel" class="spot-scroll-sentinel" aria-hidden="true"></div>
              </div>`
            : ""
        }
      </div>

      <div class="card adventure-albums explore-albums-card">
        <h3>📚 Recent adventures</h3>
        <button type="button" class="btn btn-secondary btn-full" id="btn-adv-photo">
          📸 Add photo to today’s adventure
        </button>
        ${
          albums.length
            ? `<div class="album-list">
                ${albums
                  .slice(0, 3)
                  .map((a) => renderAlbumRow(a))
                  .join("")}
              </div>
              <button type="button" class="btn btn-ghost btn-full" data-explore-view="history" style="margin-top:0.5rem">
                Browse all past adventures →
              </button>`
            : `<p class="muted small">No albums yet — snap a place photo to start one!</p>`
        }
      </div>`
      }
      ${renderAdventureCameraOverlay()}

      <p class="muted small center explore-safety">🛡️ Only take rocks where allowed · Go with a grown-up · Leave living coral alone</p>
    </section>
  `;
}

function renderAlbumRow(a) {
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
}

function renderPastAdventuresList(albums) {
  return `
    <div class="card past-adventures-card">
      <h3>📚 Past adventures</h3>
      <p class="muted small">Every outing you’ve saved — open one to view, zoom, or save all photos.</p>
      <button type="button" class="btn btn-primary btn-full" id="btn-adv-photo" style="margin:0.65rem 0">
        📸 Start / add to today’s adventure
      </button>
      ${
        albums.length
          ? `<div class="album-list album-list-full">
              ${albums.map((a) => renderAlbumRow(a)).join("")}
            </div>`
          : `<div class="empty-card"><p>No adventures yet. Snap a trail or beach photo to begin!</p></div>`
      }
    </div>`;
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

/** Compact place card — clear for kids, visited + album link when explored */
function renderSpotCard(s, { loc, checked, completedIds, albums = [] }) {
  const id = s.spotId || s.id;
  const visited = checked.has(id) || completedIds.has(id) || albums.length > 0;
  const gate = canCheckInAt({ ...s, spotId: id }, loc);
  const ch = getPhotoChallenge(s);
  const chDone = completedIds.has(id);
  const nearEnough = loc && s.lat != null && s.distanceKm != null && s.distanceKm <= 1.0;
  const m = s.mission || {};
  const rockFinds = s.rockFinds || m.finds || [];
  const latestAlbum = albums[0] || null;

  return `
    <article class="spot-card ${visited ? "visited checked" : ""}" data-spot="${id}">
      ${
        visited
          ? `<div class="visited-banner">
              <span>✅ You’ve been here!</span>
              ${
                latestAlbum
                  ? `<button type="button" class="btn btn-secondary btn-sm" data-open-album="${latestAlbum.id}">
                      📚 Open adventure album
                    </button>`
                  : ""
              }
            </div>`
          : ""
      }
      <h4>${escapeHtml(s.name)}</h4>
      <p class="muted small">${escapeHtml(s.area)} · ${escapeHtml(s.driveLabel || formatDistance(s.distanceKm))}</p>
      <p class="spot-mission-title">${m.emoji || "🪨"} ${escapeHtml(m.title || "Rock hunt")}</p>
      <p class="spot-mission-hook">${escapeHtml(m.hook || s.why || "")}</p>

      ${
        rockFinds.length
          ? `<div class="rock-chip-row">
              ${rockFinds
                .slice(0, 4)
                .map(
                  (r) =>
                    `<span class="rock-chip ${r.chanceClass || ""}" title="${escapeAttr(r.look || "")}">${escapeHtml(r.name)} <em>${escapeHtml(r.chanceShort || "")}</em></span>`
                )
                .join("")}
            </div>`
          : ""
      }

      <details class="spot-details">
        <summary>What to look for &amp; tips</summary>
        <p class="spot-look-for">${escapeHtml(m.lookFor || "Colors, textures, shiny bits!")}</p>
        ${m.rarityTease ? `<p class="spot-rarity-tease">✨ ${escapeHtml(m.rarityTease)}</p>` : ""}
        <p class="muted small">🎯 ${escapeHtml(m.miniChallenge || "Find a rock + snap the highlight!")}</p>
        <p class="tip">🛡️ ${escapeHtml(s.tips)}</p>
      </details>

      <div class="spot-challenge ${chDone ? "done" : nearEnough ? "near" : ""}">
        <span class="spot-challenge-emoji">${chDone ? "✅" : ch.emoji || "📸"}</span>
        <div>
          <strong>${escapeHtml(ch.title || "Photo")}</strong>
          <p class="muted small">${escapeHtml(ch.prompt)}</p>
          ${
            chDone
              ? `<em class="muted">Photo challenge done</em>`
              : nearEnough
                ? `<button type="button" class="btn btn-secondary btn-sm" data-challenge-snap="${escapeAttr(id)}">📸 Snap for +XP</button>`
                : `<em class="muted">Get close to unlock</em>`
          }
        </div>
      </div>

      ${
        checked.has(id)
          ? `<p class="checkin-done">📍 Checked in</p>`
          : `<button type="button" class="btn btn-primary btn-checkin" data-checkin="${id}"
              data-name="${escapeAttr(s.name)}"
              data-generic="${s.generic ? "1" : "0"}"
              data-lat="${s.lat ?? ""}"
              data-lng="${s.lng ?? ""}"
            >${gate.ok ? "📍 I'm here — Check in!" : "📍 Check in (get closer)"}</button>`
      }
      ${
        albums.length > 1
          ? `<p class="muted small">${albums.length} adventure albums from this place</p>`
          : ""
      }
    </article>`;
}

function renderAdventureAlbumDetail(album) {
  const photos = album.photos || [];
  return `
    <section class="screen explore-screen">
      <header class="screen-header">
        <button type="button" class="btn btn-secondary" id="btn-back-albums">← Past adventures</button>
        <h1 style="margin-top:0.75rem">${escapeHtml(album.title || "Adventure")}</h1>
        <p>${escapeHtml(album.subtitle || "")} · ${photos.length} photo${photos.length === 1 ? "" : "s"}</p>
      </header>
      <div class="card">
        <p class="muted small">Tap a photo to open full screen &amp; zoom. Save the whole outing to your phone anytime.</p>
        <button type="button" class="btn btn-primary btn-full" id="btn-adv-photo" style="margin:0.65rem 0">
          📸 Add photo to this adventure
        </button>
        ${
          photos.length
            ? `<button type="button" class="btn btn-secondary btn-full" id="btn-save-album-all">
                📤 Save whole album to Photos (${photos.length})
              </button>`
            : ""
        }
        <button type="button" class="btn btn-secondary btn-full" id="btn-rename-album" style="margin-top:0.5rem">✏️ Rename album</button>
      </div>
      ${
        photos.length
          ? `<div class="adv-grid">
              ${photos
                .map(
                  (p, idx) => `
                <figure class="adv-card">
                  <button type="button" class="adv-card-open" data-view-photo="${idx}" aria-label="Open photo full screen">
                    <img src="${p.dataUrl}" alt="" />
                    <span class="adv-card-zoom-hint">🔍 Tap to zoom</span>
                  </button>
                  <figcaption>
                    ${p.placeLabel ? `<strong>${escapeHtml(p.placeLabel)}</strong>` : ""}
                    <div class="adv-photo-actions">
                      <button type="button" class="btn btn-secondary btn-sm" data-share-adv="${p.id}">📤 Save</button>
                      <button type="button" class="btn-ghost-sm btn-del-photo" data-del-adv="${p.id}">🗑️ Delete</button>
                    </div>
                  </figcaption>
                </figure>`
                )
                .join("")}
            </div>`
          : `<div class="empty-card"><p>No photos in this album yet.</p></div>`
      }
      <button type="button" class="btn btn-primary btn-full" id="btn-adv-photo-again" style="margin-top:0.75rem">
        📸 Keep adding photos to this adventure
      </button>
      <div class="card album-danger-zone">
        <p class="muted small">Want a clean slate for this outing?</p>
        <button type="button" class="btn btn-ghost btn-full btn-delete-danger" id="btn-del-album">
          🗑️ Delete whole adventure album
        </button>
      </div>
      ${renderAdventureCameraOverlay()}
    </section>
  `;
}

/** Full-screen adventure photo review with pinch/button zoom */
function renderPhotoViewer() {
  const pv = state.photoViewer;
  if (!pv?.photos?.length) return "";
  const idx = Math.max(0, Math.min(pv.index || 0, pv.photos.length - 1));
  const photo = pv.photos[idx];
  if (!photo?.dataUrl) return "";
  const z = state.viewerZoom || 1;
  return `
    <div class="photo-viewer" id="photo-viewer" role="dialog" aria-label="Photo full screen">
      <header class="photo-viewer-top">
        <button type="button" class="btn btn-ghost" id="btn-viewer-close" aria-label="Close">✕</button>
        <div class="photo-viewer-meta">
          <strong>${escapeHtml(pv.title || "Photo")}</strong>
          <span>${idx + 1} / ${pv.photos.length}</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-viewer-share">📤 Save</button>
      </header>
      <div class="photo-viewer-stage" id="photo-viewer-stage">
        <img src="${photo.dataUrl}" alt="" id="viewer-img" style="transform: scale(${z})" draggable="false" />
      </div>
      <div class="photo-viewer-bottom">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-viewer-prev" ${idx <= 0 ? "disabled" : ""}>‹ Prev</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-viewer-zoom-out">−</button>
        <span class="zoom-label">${z.toFixed(1)}×</span>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-viewer-zoom-in">+</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-viewer-next" ${idx >= pv.photos.length - 1 ? "disabled" : ""}>Next ›</button>
      </div>
    </div>`;
}

/**
 * iOS often shifts the page under the status bar after a fixed full-screen
 * overlay. Lock body while open; restore scroll + safe-area when closed.
 */
function lockScrollForPhotoViewer() {
  const y = window.scrollY || window.pageYOffset || 0;
  state.photoViewerScrollY = y;
  document.documentElement.classList.add("photo-viewer-open");
  document.body.classList.add("photo-viewer-open");
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockScrollAfterPhotoViewer() {
  const y = state.photoViewerScrollY || 0;
  document.documentElement.classList.remove("photo-viewer-open");
  document.body.classList.remove("photo-viewer-open");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  // Restore scroll after layout is free of position:fixed
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
    // Second frame: force iOS to recompute safe-area after overlay removal
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
      // Nudge layout without visible jump (helps Dynamic Island / notch)
      const shell = document.querySelector(".app-shell");
      if (shell) {
        shell.style.transform = "translateZ(0)";
        // eslint-disable-next-line no-unused-expressions
        shell.offsetHeight;
        shell.style.transform = "";
      }
    });
  });
}

function openPhotoViewer(photos, index, title) {
  lockScrollForPhotoViewer();
  state.photoViewer = {
    photos: (photos || []).filter((p) => p?.dataUrl),
    index: index || 0,
    title: title || "Adventure photo",
  };
  state.viewerZoom = 1;
}

function closePhotoViewer() {
  state.photoViewer = null;
  state.viewerZoom = 1;
  unlockScrollAfterPhotoViewer();
}

function bindPhotoViewer() {
  // Keep body lock in sync if we re-rendered while viewer is open
  if (state.photoViewer) {
    if (!document.body.classList.contains("photo-viewer-open")) {
      lockScrollForPhotoViewer();
    }
  } else if (document.body.classList.contains("photo-viewer-open")) {
    unlockScrollAfterPhotoViewer();
  }

  if (!state.photoViewer) return;

  const setZoom = (z) => {
    state.viewerZoom = Math.max(1, Math.min(4, z));
    const img = $("#viewer-img");
    if (img) img.style.transform = `scale(${state.viewerZoom})`;
    const label = document.querySelector(".photo-viewer-bottom .zoom-label");
    if (label) label.textContent = `${state.viewerZoom.toFixed(1)}×`;
  };

  const closeAndRender = async () => {
    closePhotoViewer();
    // Do NOT preserveScroll here — unlockScrollAfterPhotoViewer restores it
    await render({ preserveScroll: false });
    // Re-apply saved scroll after render rewrote the DOM
    const y = state.photoViewerScrollY || 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
  };

  $("#btn-viewer-close")?.addEventListener("click", () => closeAndRender());
  $("#btn-viewer-prev")?.addEventListener("click", async () => {
    if (!state.photoViewer || state.photoViewer.index <= 0) return;
    state.photoViewer.index -= 1;
    state.viewerZoom = 1;
    // Stay locked; re-render overlay content only
    await render({ preserveScroll: false });
  });
  $("#btn-viewer-next")?.addEventListener("click", async () => {
    if (!state.photoViewer) return;
    if (state.photoViewer.index >= state.photoViewer.photos.length - 1) return;
    state.photoViewer.index += 1;
    state.viewerZoom = 1;
    await render({ preserveScroll: false });
  });
  $("#btn-viewer-zoom-in")?.addEventListener("click", () => setZoom((state.viewerZoom || 1) + 0.5));
  $("#btn-viewer-zoom-out")?.addEventListener("click", () => setZoom((state.viewerZoom || 1) - 0.5));
  $("#btn-viewer-share")?.addEventListener("click", async () => {
    const p = state.photoViewer?.photos?.[state.photoViewer.index];
    if (!p?.dataUrl) return;
    try {
      const how = await shareOrSavePhoto(p.dataUrl, {
        title: state.photoViewer.title || "Adventure photo",
        filename: `adventure-${Date.now()}.jpg`,
      });
      if (how !== "cancelled") toast("Shared — Save Image to keep it in Photos!", "success");
    } catch (e) {
      toast(e.message || "Could not share", "error");
    }
  });

  // Pinch-to-zoom on the stage
  const stage = $("#photo-viewer-stage");
  if (stage) {
    let startDist = 0;
    let startZoom = 1;
    const dist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    stage.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          startDist = dist(e.touches[0], e.touches[1]);
          startZoom = state.viewerZoom || 1;
        }
      },
      { passive: true }
    );
    stage.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && startDist > 0) {
          e.preventDefault();
          const scale = dist(e.touches[0], e.touches[1]) / startDist;
          setZoom(startZoom * scale);
        }
      },
      { passive: false }
    );
    // Double-tap toggle zoom
    let lastTap = 0;
    stage.addEventListener("click", () => {
      const now = Date.now();
      if (now - lastTap < 320) {
        setZoom((state.viewerZoom || 1) > 1.2 ? 1 : 2.5);
      }
      lastTap = now;
    });
  }
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
  const faceLabel = state.facingMode === "user" ? "🤳 Selfie" : "📷 Rear";
  return `
    <div class="adv-cam-overlay" id="adv-cam-overlay" role="dialog" aria-label="Take adventure photo">
      <div class="adv-cam-sheet">
        <header class="adv-cam-header">
          <h2>${escapeHtml(header)}</h2>
          <button type="button" class="btn btn-ghost" id="btn-adv-cam-close" aria-label="Close">✕</button>
        </header>
        ${
          state.challengeSpotId
            ? `<p class="adv-cam-challenge-prompt">${escapeHtml(challengeHint)}
                <br/><span class="muted small">Must show the real target — scenery alone won’t unlock!</span></p>`
            : ""
        }
        <div class="adv-cam-viewfinder">
          <video id="adv-cam-video" playsinline autoplay muted></video>
          <div class="adv-cam-hint">${escapeHtml(challengeHint)}</div>
        </div>
        <div class="cam-toolbar">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-adv-flip">${faceLabel} · flip</button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-adv-zoom-out">− Zoom</button>
          <span class="zoom-label" id="adv-zoom-label">${(state.zoom || 1).toFixed(1)}×</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-adv-zoom-in">Zoom +</button>
        </div>
        <div class="adv-cam-actions">
          <button type="button" class="btn btn-primary btn-xl btn-full" id="btn-adv-snap">📷 Snap photo!</button>
          <label class="btn btn-secondary btn-full file-btn">
            🖼️ From gallery instead
            <input type="file" id="adv-photo-input" accept="image/*" hidden />
          </label>
          <button type="button" class="btn btn-ghost btn-full" id="btn-adv-cam-cancel">Cancel</button>
        </div>
      </div>
    </div>`;
}

function updateZoomLabel() {
  const el = $("#adv-zoom-label") || $("#id-zoom-label");
  if (el) el.textContent = `${(state.zoom || 1).toFixed(1)}×`;
}

function renderStickyAdventureBar() {
  if (!state.activeAdventureId) return "";
  // Hide when already viewing that album
  if (state.route === "explore" && state.adventureAlbumId === state.activeAdventureId && !state.adventureCamOpen) {
    /* still show compact bar so they can add photos */
  }
  const title = state.activeAdventureTitle || "Today’s adventure";
  return `
    <div class="sticky-adventure-bar" role="region" aria-label="Active adventure">
      <div class="sticky-adventure-info">
        <strong>🗺️ On adventure</strong>
        <span>${escapeHtml(title)}</span>
      </div>
      <div class="sticky-adventure-actions">
        <button type="button" class="btn btn-primary btn-sm" id="btn-sticky-add-photo">📸 Add photo</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-sticky-open-album">Album</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-sticky-end" title="End adventure mode">End</button>
      </div>
    </div>`;
}

function bindStickyAdventureBar() {
  $("#btn-sticky-add-photo")?.addEventListener("click", async () => {
    if (state.activeAdventureId) state.adventureAlbumId = state.activeAdventureId;
    state.route = "explore";
    setActiveNav("explore");
    openAdventureCamera({ challengeSpotId: null });
    await render();
  });
  $("#btn-sticky-open-album")?.addEventListener("click", async () => {
    if (!state.activeAdventureId) return;
    state.adventureAlbumId = state.activeAdventureId;
    state.route = "explore";
    setActiveNav("explore");
    closeAdventureCamera();
    await render();
  });
  $("#btn-sticky-end")?.addEventListener("click", async () => {
    clearActiveAdventure();
    toast("Adventure mode ended — albums are still saved!", "info");
    await render();
  });
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

  async function startIdCamera() {
    stopCamera();
    state.photoDataUrl = null;
    state.lastResult = null;
    // Keep facing/zoom; re-render viewfinder
    const stream = await openCameraStream({
      facingMode: state.facingMode || "environment",
      zoom: state.zoom || 1,
    });
    state.stream = stream;
    await render({ preserveScroll: true });
    const v = $("#cam-video");
    if (v) {
      v.srcObject = stream;
      await v.play();
    }
    const snap = $("#btn-snap");
    if (snap) snap.disabled = false;
    updateZoomLabel();
    markCameraGranted();
  }

  $("#btn-start-cam")?.addEventListener("click", async () => {
    try {
      await startIdCamera();
      toast("Camera ready!", "success");
    } catch {
      toast("Camera blocked — try Gallery upload instead.", "error");
    }
  });

  $("#btn-id-flip")?.addEventListener("click", async () => {
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    state.zoom = 1;
    try {
      await startIdCamera();
    } catch {
      toast("Could not switch camera", "error");
    }
  });
  $("#btn-id-zoom-out")?.addEventListener("click", async () => {
    state.zoom = Math.max(1, (state.zoom || 1) - 0.5);
    const r = await applyZoom(state.stream, state.zoom);
    if (!r.ok && r.reason === "unsupported") toast("Zoom not available — move closer!", "info");
    updateZoomLabel();
  });
  $("#btn-id-zoom-in")?.addEventListener("click", async () => {
    state.zoom = Math.min(8, (state.zoom || 1) + 0.5);
    const r = await applyZoom(state.stream, state.zoom);
    if (!r.ok && r.reason === "unsupported") toast("Zoom not available — move closer!", "info");
    updateZoomLabel();
  });

  $("#btn-share-id-photo")?.addEventListener("click", async () => {
    if (!state.photoDataUrl) return;
    try {
      const how = await shareOrSavePhoto(state.photoDataUrl, {
        title: "Rock Quest Oahu photo",
        filename: `rock-quest-${Date.now()}.jpg`,
      });
      if (how !== "cancelled") toast("Use Share → Save Image to keep it in Photos!", "success");
    } catch (e) {
      toast(e.message || "Could not share photo", "error");
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
    // Compressed JPEG for weak signal
    try {
      const raw = canvas.toDataURL("image/jpeg", 0.85);
      state.photoDataUrl = await compressForUpload(raw, { maxSide: 900, quality: 0.68 });
    } catch {
      state.photoDataUrl = canvas.toDataURL("image/jpeg", 0.7);
    }
    stopCamera();
    state.lastResult = null;
    await render();
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      stopCamera();
      state.photoDataUrl = await fileToDataUrl(file, 900, 0.68);
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

  $("#btn-save-later")?.addEventListener("click", () => savePhotoForLater());

  app.querySelectorAll("[data-pending-run]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.pendingRun;
      const list = await getPendingIdentifies();
      const item = list.find((p) => p.id === id);
      if (!item) return;
      state.photoDataUrl = item.dataUrl;
      state.foundOutside = !!item.foundOutside;
      state.lastResult = null;
      await render();
      await runIdentify({
        dataUrl: item.dataUrl,
        foundOutside: item.foundOutside,
        location: item.location,
        pendingId: item.id,
      });
    });
  });

  app.querySelectorAll("[data-pending-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await removePendingIdentify(btn.dataset.pendingDel);
      toast("Removed saved photo", "info");
      await render();
    });
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

async function savePhotoForLater(dataUrl = null, foundOutside = null) {
  const photo = dataUrl || state.photoDataUrl;
  if (!photo) {
    toast("Take a photo first", "error");
    return;
  }
  try {
    const compressed = await compressForUpload(photo, { maxSide: 800, quality: 0.6 });
    let location = null;
    const outdoor = foundOutside != null ? foundOutside : state.foundOutside;
    if (outdoor && state.outdoorLocation) location = state.outdoorLocation;
    await addPendingIdentify({
      dataUrl: compressed,
      foundOutside: outdoor,
      location,
    });
    toast("📦 Saved! Identify later when signal is better.", "success");
    state.photoDataUrl = null;
    state.lastResult = null;
    await render();
  } catch (e) {
    toast(e.message || "Could not save photo", "error");
  }
}

function setIdentifyProgress({ message = "Working…", pct = 20 } = {}) {
  const status = $("#identify-status");
  if (!status) return;
  status.classList.remove("hidden");
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  status.innerHTML = `
    <div class="id-progress card">
      <div class="spinner"></div>
      <p class="id-progress-msg">${escapeHtml(message)}</p>
      <div class="id-progress-track" aria-hidden="true">
        <div class="id-progress-fill" style="width:${clamped}%"></div>
      </div>
      <p class="muted small">On weak cell signal this can take a bit — we retry automatically.</p>
    </div>`;
}

async function runIdentify(opts = {}) {
  const photo = opts.dataUrl || state.photoDataUrl;
  if (!photo) return;
  const pendingId = opts.pendingId || null;
  const foundOutside = opts.foundOutside != null ? opts.foundOutside : state.foundOutside;
  const status = $("#identify-status");
  const results = $("#identify-results");
  setIdentifyProgress({ message: "Getting ready…", pct: 5 });
  if (results) results.innerHTML = "";
  $("#btn-identify") && ($("#btn-identify").disabled = true);
  $("#btn-save-later") && ($("#btn-save-later").disabled = true);

  try {
    state.visionStatus = await getVisionStatus(true);
    if (!state.visionStatus?.vision) {
      status.innerHTML = `
        <div class="setup-error card">
          <h3>🔭 Real vision isn’t configured yet</h3>
          <p>Rock Quest Oahu needs an <strong>xAI API key</strong> to identify rocks from photos.</p>
          <ol class="setup-steps">
            <li>Get a key at <a href="https://console.x.ai" target="_blank" rel="noopener">console.x.ai</a></li>
            <li><strong>Live site:</strong> Netlify → Environment variables → <code>XAI_API_KEY</code> → Redeploy</li>
            <li><strong>Local Mac:</strong> paste in the box above, or put it in <code>.env</code></li>
          </ol>
        </div>`;
      toast("Add XAI_API_KEY for real rock IDs", "error");
      return;
    }

    let locationPayload = opts.location || null;
    if (foundOutside && !locationPayload) {
      setIdentifyProgress({ message: "Getting location (optional)…", pct: 12 });
      try {
        const pos = await getPosition(8000);
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
        toast("No GPS right now — identifying from the photo only.", "info");
        state.outdoorLocation = null;
      }
    } else if (!foundOutside) {
      state.outdoorLocation = null;
    }

    const result = await identifyRock(photo, {
      foundOutside,
      location: locationPayload,
      maxRetries: 3,
      onProgress: (p) => setIdentifyProgress(p),
    });
    state.lastResult = result;
    state.fieldXpAwarded = new Set();
    if (!opts.keepPhoto) state.photoDataUrl = photo;
    await bumpIdentifyCount();

    if (pendingId) await removePendingIdentify(pendingId);

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
    if (pendingId) await render();
  } catch (e) {
    console.error(e);
    if (e.code === "needs_key") {
      clearVisionStatusCache();
      state.visionStatus = await getVisionStatus(true);
      status.innerHTML = `
        <div class="setup-error card">
          <h3>API key needed</h3>
          <p>${escapeHtml(e.message)}</p>
        </div>`;
    } else {
      const canSave = !!state.photoDataUrl || !!photo;
      status.innerHTML = `
        <div class="setup-error card">
          <h3>Couldn’t finish identify</h3>
          <p class="error-text">${escapeHtml(e.message)}</p>
          <p class="muted small">Weak signal is common outdoors. We already retried automatically.</p>
          <div class="id-fail-actions">
            <button type="button" class="btn btn-primary" id="btn-retry-identify">🔁 Try again</button>
            ${
              canSave
                ? `<button type="button" class="btn btn-secondary" id="btn-fail-save-later">📦 Save for later</button>`
                : ""
            }
          </div>
        </div>`;
      $("#btn-retry-identify")?.addEventListener("click", () =>
        runIdentify({ dataUrl: photo, foundOutside, location: opts.location, pendingId })
      );
      $("#btn-fail-save-later")?.addEventListener("click", () => savePhotoForLater(photo, foundOutside));
    }
    toast(e.message, "error");
  } finally {
    const btn = $("#btn-identify");
    if (btn) btn.disabled = !state.photoDataUrl;
    const saveLater = $("#btn-save-later");
    if (saveLater) saveLater.disabled = !state.photoDataUrl;
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
      ${
        f.photoDataUrl
          ? `<button type="button" class="btn btn-secondary btn-full" id="btn-share-find" style="margin-top:0.65rem">
              📤 Save / Share photo to phone
            </button>`
          : ""
      }
      <button type="button" class="btn btn-ghost btn-full btn-delete-danger" id="btn-delete-find">
        🗑️ Delete this rock from my Dex
      </button>
      <p class="muted small center">Deletes this find only — you can always collect it again later.</p>
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

  $("#btn-share-find")?.addEventListener("click", async () => {
    if (!f.photoDataUrl) return;
    try {
      const how = await shareOrSavePhoto(f.photoDataUrl, {
        title: f.nickname || f.name || "Rock Quest Oahu",
        filename: `rock-dex-${(f.name || "rock").replace(/\s+/g, "-")}-${Date.now()}.jpg`,
      });
      if (how !== "cancelled") toast("Shared — pick Save Image / Photos to keep it!", "success");
    } catch (e) {
      toast(e.message || "Could not share", "error");
    }
  });

  $("#btn-delete-find")?.addEventListener("click", async () => {
    const label = f.nickname || f.name || "this rock";
    const ok = window.confirm(
      `Delete “${label}” from your Rock Dex?\n\nThis cannot be undone. (You can collect another one later!)`
    );
    if (!ok) return;
    await deleteFind(id);
    document.querySelector(".modal-backdrop")?.remove();
    toast("Rock removed from your Dex", "info");
    await render();
  });
}

/** Open camera for adventure album snaps (rear or selfie + zoom). */
async function startAdventureCamera() {
  const v = $("#adv-cam-video");
  if (!v) return;
  try {
    stopCamera();
    const stream = await openCameraStream({
      facingMode: state.facingMode || "environment",
      zoom: state.zoom || 1,
    });
    state.stream = stream;
    v.srcObject = stream;
    await v.play();
    const zr = getZoomRange(stream);
    if (zr.supported) state.zoom = zr.current || state.zoom || 1;
    updateZoomLabel();
    markCameraGranted();
    toast(
      state.facingMode === "user" ? "Selfie camera ready!" : "Camera ready — snap the adventure!",
      "success"
    );
  } catch (err) {
    console.warn("Adventure camera failed", err);
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
  let compressed = dataUrl;
  try {
    compressed = await compressForUpload(dataUrl, { maxSide: 960, quality: 0.7 });
  } catch {
    compressed = dataUrl;
  }
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
    dataUrl: compressed,
    note: challengeSpot ? getPhotoChallenge(challengeSpot).title : "",
    lat,
    lng,
    placeLabel: placeLabel || openAlbum?.placeLabel || "Adventure",
    dateKey: openAlbum?.dateKey,
    spotId: challengeId || openAlbum?.spotId || null,
  });
  state.adventureAlbumId = album?.id || state.adventureAlbumId;
  await grantAdventurePhotoXp();

  // Only unlock challenges when this snap was for that challenge + vision match
  const challengeResult = await maybeCompletePhotoChallenge({
    preferredSpotId: challengeId,
    lat,
    lng,
    dataUrl: compressed,
  });

  if (album) setActiveAdventure(album);

  if (challengeResult?.isNew) {
    toast(`🎯 Challenge complete! +XP · Saved to “${album?.title || "Adventure"}”`, "success");
  } else if (!challengeResult?.rejected) {
    toast(`Saved to “${album?.title || "Adventure"}” 📸`, "success");
  }
  sparkleBurst(document.body);
  state.challengeSpotId = null;
  await evaluateBadges({ celebrate: true });
  await render();
}

/**
 * Complete a photo challenge only when:
 * 1) User explicitly snapped for that challenge (preferredSpotId), AND
 * 2) GPS is near the place, AND
 * 3) Vision confirms the photo shows the required subject (not random trail scenery).
 */
async function maybeCompletePhotoChallenge({
  preferredSpotId = null,
  lat = null,
  lng = null,
  dataUrl = null,
} = {}) {
  // Never auto-complete from a random adventure photo near a spot
  if (!preferredSpotId) return { isNew: false, skipped: true };

  const loc =
    lat != null && lng != null
      ? { lat, lng, accuracy: state.location?.accuracy }
      : state.location;
  if (!loc) {
    toast("Photo saved! Turn on location near the place to unlock the challenge.", "info");
    return { isNew: false };
  }

  const completedMap = await getPhotoChallengesCompleted();
  if (completedMap[preferredSpotId]) return { isNew: false };

  const target = findSpotById(preferredSpotId);
  if (!target) return { isNew: false };

  const near = getNearbyChallengeSpots(loc, {
    completedIds: new Set(Object.keys(completedMap)),
  });
  if (!near.some((s) => s.id === preferredSpotId)) {
    toast("Photo saved! Get closer to the place to finish the challenge.", "info");
    return { isNew: false };
  }

  const ch = getPhotoChallenge(target);
  if (!dataUrl) {
    toast("Photo saved — open the challenge again and snap the real target to unlock XP.", "info");
    return { isNew: false };
  }

  try {
    toast("Checking if this photo shows the real target…", "info");
    const verify = await verifyChallengePhoto(dataUrl, {
      verifyTarget: ch.verifyTarget || ch.prompt,
      placeName: target.name,
    });
    if (!verify.match) {
      toast(
        verify.reason ||
          "Nice photo — but it doesn’t clearly show the challenge target. Try again!",
        "error"
      );
      return { isNew: false, rejected: true, reason: verify.reason };
    }
  } catch (e) {
    if (e.code === "needs_key") {
      toast("Challenge photo check needs vision key — photo still saved.", "info");
      return { isNew: false };
    }
    // Offline: do not unlock (strict)
    toast(
      e.message || "Couldn’t verify challenge (need signal). Photo saved — try unlock again later.",
      "error"
    );
    return { isNew: false };
  }

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
      state.location = await getPosition({
        timeout: 20000,
        maximumAge: 5_000,
        highAccuracy: true,
        allowCached: false,
      });
      state.spotShowCount = SPOTS_PAGE_SIZE;
      ensureLocationWatch();
      toast(
        state.location?.stale
          ? "Using last known location — walk a few steps and refresh"
          : "Location locked in!",
        "success"
      );
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
    state.exploreView = "history";
    closeAdventureCamera();
    closePhotoViewer();
    await render();
  });

  app.querySelectorAll("[data-explore-view]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.exploreView = btn.dataset.exploreView === "history" ? "history" : "places";
      state.adventureAlbumId = null;
      await render();
    });
  });

  app.querySelectorAll("[data-view-photo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.viewPhoto);
      const alb = state.adventureAlbumId
        ? await getAdventureAlbum(state.adventureAlbumId)
        : null;
      if (!alb?.photos?.length) return;
      openPhotoViewer(alb.photos, idx, alb.title || "Adventure");
      await render({ preserveScroll: true });
    });
  });

  $("#btn-save-album-all")?.addEventListener("click", async () => {
    const alb = state.adventureAlbumId
      ? await getAdventureAlbum(state.adventureAlbumId)
      : null;
    const photos = alb?.photos || [];
    if (!photos.length) {
      toast("No photos to save yet", "info");
      return;
    }
    try {
      toast(`Preparing ${photos.length} photos…`, "info");
      const result = await shareOrSaveAlbum(photos, {
        title: alb.title || "Rock Quest Oahu adventure",
        albumName: alb.title || "adventure",
        onProgress: (i, n) => {
          if (i === 1 || i === n) toast(`Saving photo ${i} of ${n}…`, "info");
        },
      });
      if (result.mode === "cancelled") {
        toast("Save cancelled", "info");
      } else if (result.mode === "shared") {
        toast(`Shared ${result.count} photos — pick Save Image / Photos!`, "success");
      } else if (result.mode === "partial") {
        toast(`Saved ${result.count} photos before cancel`, "info");
      } else {
        toast(`Downloaded ${result.count} photos to your device`, "success");
      }
    } catch (e) {
      toast(e.message || "Could not save album", "error");
    }
  });

  app.querySelectorAll("[data-open-album]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.adventureAlbumId = btn.dataset.openAlbum;
      const alb = await getAdventureAlbum(btn.dataset.openAlbum);
      if (alb) setActiveAdventure(alb);
      closeAdventureCamera();
      await render();
    });
  });

  $("#btn-adv-photo-again")?.addEventListener("click", async () => {
    if (state.adventureAlbumId) {
      const alb = await getAdventureAlbum(state.adventureAlbumId);
      if (alb) setActiveAdventure(alb);
    }
    openAdventureCamera({ challengeSpotId: null });
    await render();
  });

  app.querySelectorAll("[data-share-adv]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const photoId = btn.dataset.shareAdv;
      const alb = state.adventureAlbumId
        ? await getAdventureAlbum(state.adventureAlbumId)
        : null;
      const photo = (alb?.photos || []).find((p) => p.id === photoId);
      if (!photo?.dataUrl) {
        toast("Photo not found", "error");
        return;
      }
      try {
        const how = await shareOrSavePhoto(photo.dataUrl, {
          title: alb?.title || "Adventure photo",
          filename: `adventure-${Date.now()}.jpg`,
        });
        if (how !== "cancelled") toast("Shared — Save Image to put it in Photos!", "success");
      } catch (e) {
        toast(e.message || "Could not share", "error");
      }
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
    const alb = await getAdventureAlbum(state.adventureAlbumId);
    const title = alb?.title || "this adventure";
    const n = alb?.photos?.length || 0;
    const ok = window.confirm(
      `Delete the whole album “${title}”?\n\nThis removes all ${n} photo${n === 1 ? "" : "s"} in it. This cannot be undone.`
    );
    if (!ok) return;
    await deleteAdventureAlbum(state.adventureAlbumId);
    state.adventureAlbumId = null;
    toast("Adventure album deleted", "info");
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
      const ok = window.confirm(
        "Delete this adventure photo?\n\nIt’s gone for good — you can always take a new one later."
      );
      if (!ok) return;
      await deleteAdventurePhoto(btn.dataset.delAdv);
      toast("Photo deleted", "info");
      // if album empty, go back to list
      if (state.adventureAlbumId) {
        const a = await getAdventureAlbum(state.adventureAlbumId);
        if (!a || !(a.photos || []).length) {
          // Empty album: offer to remove the empty shell
          const clearEmpty = window.confirm(
            "That was the last photo in this album.\n\nDelete the empty adventure album too?"
          );
          if (clearEmpty) {
            await deleteAdventureAlbum(state.adventureAlbumId);
            toast("Empty album deleted", "info");
          }
          state.adventureAlbumId = null;
        }
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
        // Fresh high-accuracy fix for check-in (don't use stale 60s cache)
        state.location = await getPosition({
          timeout: 20000,
          maximumAge: 0,
          highAccuracy: true,
          allowCached: true,
        });
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

// Restore adventure session + location if already permitted (no re-prompt loop)
bootstrapLocation().finally(() => navigate("home"));
