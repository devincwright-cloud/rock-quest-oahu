/**
 * Local-first Rock Dex (IndexedDB) — one library per browser/device.
 */
const DB_NAME = "RockQuestDB";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("finds")) {
        const s = db.createObjectStore("finds", { keyPath: "id" });
        s.createIndex("byRockId", "rockId", { unique: false });
        s.createIndex("byFavorite", "favorite", { unique: false });
        s.createIndex("byCreated", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("seen")) {
        db.createObjectStore("seen", { keyPath: "rockId" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getMeta(key, fallback = null) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key, value) {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key, value });
  await txDone(tx);
}

export async function getXp() {
  return (await getMeta("xp", 0)) || 0;
}

export async function addXp(amount) {
  const xp = (await getXp()) + amount;
  await setMeta("xp", xp);
  return xp;
}

export async function getBadgesEarned() {
  return (await getMeta("badges", [])) || [];
}

export async function saveBadgesEarned(list) {
  await setMeta("badges", list);
}

export async function getFlags() {
  return (await getMeta("flags", {})) || {};
}

export async function setFlag(name, value = true) {
  const flags = await getFlags();
  flags[name] = value;
  await setMeta("flags", flags);
  return flags;
}

/** Adventure check-ins: [{ spotId, name, at, lat, lng }] */
export async function getCheckIns() {
  return (await getMeta("checkIns", [])) || [];
}

export async function addCheckIn(entry) {
  const list = await getCheckIns();
  const already = list.some((c) => c.spotId === entry.spotId);
  list.push({
    spotId: entry.spotId,
    name: entry.name,
    at: Date.now(),
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
  });
  await setMeta("checkIns", list);
  return { list, isNewSpot: !already };
}

/**
 * Photo challenges completed by spotId:
 * { [spotId]: { at, title, name, lat, lng } }
 */
export async function getPhotoChallengesCompleted() {
  return (await getMeta("photoChallenges", {})) || {};
}

export async function isPhotoChallengeDone(spotId) {
  if (!spotId) return false;
  const map = await getPhotoChallengesCompleted();
  return !!map[spotId];
}

/**
 * Mark a place photo challenge complete (once per spot for full XP).
 * Returns { isNew, completed }
 */
export async function completePhotoChallenge({ spotId, name, title, lat, lng }) {
  if (!spotId) return { isNew: false, completed: await getPhotoChallengesCompleted() };
  const map = await getPhotoChallengesCompleted();
  if (map[spotId]) {
    return { isNew: false, completed: map };
  }
  map[spotId] = {
    at: Date.now(),
    name: name || spotId,
    title: title || "Photo challenge",
    lat: lat ?? null,
    lng: lng ?? null,
  };
  await setMeta("photoChallenges", map);
  return { isNew: true, completed: map };
}

/**
 * Photos saved offline / for later identify (weak signal).
 * [{ id, dataUrl, foundOutside, location, createdAt, note }]
 */
export async function getPendingIdentifies() {
  return (await getMeta("pendingIdentifies", [])) || [];
}

export async function addPendingIdentify(entry) {
  const list = await getPendingIdentifies();
  const item = {
    id: entry.id || `pend_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    dataUrl: entry.dataUrl,
    foundOutside: !!entry.foundOutside,
    location: entry.location || null,
    note: entry.note || "",
    createdAt: entry.createdAt || Date.now(),
  };
  const next = [item, ...list.filter((p) => p.id !== item.id)].slice(0, 10);
  await setMeta("pendingIdentifies", next);
  return item;
}

export async function removePendingIdentify(id) {
  const list = await getPendingIdentifies();
  const next = list.filter((p) => p.id !== id);
  await setMeta("pendingIdentifies", next);
  return next;
}

export async function clearPendingIdentifies() {
  await setMeta("pendingIdentifies", []);
}

export async function markSeen(rockId, sample) {
  const db = await openDb();
  const tx = db.transaction("seen", "readwrite");
  const store = tx.objectStore("seen");
  const existing = await new Promise((res, rej) => {
    const r = store.get(rockId);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const isNew = !existing;
  store.put({
    rockId,
    name: sample?.name || rockId,
    rarity: sample?.rarity || "common",
    firstSeenAt: existing?.firstSeenAt || Date.now(),
    lastSeenAt: Date.now(),
    timesSeen: (existing?.timesSeen || 0) + 1,
  });
  await txDone(tx);
  return { isNew };
}

export async function getAllSeen() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("seen", "readonly");
    const req = tx.objectStore("seen").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function addFind(find) {
  const db = await openDb();
  const record = {
    id: find.id || `find_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    rockId: find.rockId,
    name: find.name,
    rarity: find.rarity || "common",
    nickname: find.nickname || "",
    notes: find.notes || "",
    favorite: !!find.favorite,
    photoDataUrl: find.photoDataUrl || null,
    confidence: find.confidence ?? null,
    baseConfidence: find.baseConfidence ?? find.confidence ?? null,
    properties: find.properties || null,
    facts: find.facts || [],
    fieldTests: find.fieldTests || [],
    fieldAnswers: find.fieldAnswers || {},
    valueNote: find.valueNote || "",
    summary: find.summary || "",
    demo: !!find.demo,
    /** true when kid marked “found outside” */
    foundOutside: !!find.foundOutside,
    /**
     * { lat, lng, label, placeName, accuracy }
     * only when foundOutside and location was available
     */
    foundLocation: find.foundLocation || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const tx = db.transaction("finds", "readwrite");
  tx.objectStore("finds").put(record);
  await txDone(tx);
  return record;
}

export async function updateFind(id, patch) {
  const db = await openDb();
  const tx = db.transaction("finds", "readwrite");
  const store = tx.objectStore("finds");
  const existing = await new Promise((res, rej) => {
    const r = store.get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  if (!existing) throw new Error("Find not found");
  const next = { ...existing, ...patch, id, updatedAt: Date.now() };
  store.put(next);
  await txDone(tx);
  return next;
}

export async function getFind(id) {
  const finds = await getAllFinds();
  return finds.find((f) => f.id === id) || null;
}

export async function deleteFind(id) {
  const db = await openDb();
  const tx = db.transaction("finds", "readwrite");
  tx.objectStore("finds").delete(id);
  await txDone(tx);
}

export async function getAllFinds() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("finds", "readonly");
    const req = tx.objectStore("finds").getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getStats() {
  const [finds, seen, flags, badges, xp, checkIns, photoChallenges] = await Promise.all([
    getAllFinds(),
    getAllSeen(),
    getFlags(),
    getBadgesEarned(),
    getXp(),
    getCheckIns(),
    getPhotoChallengesCompleted(),
  ]);
  const collectedIds = [...new Set(finds.map((f) => f.rockId))];
  const uniqueCheckIns = new Set(checkIns.map((c) => c.spotId));
  const fieldTestedFinds = finds.filter((f) => {
    const ans = f.fieldAnswers || {};
    return Object.keys(ans).length > 0;
  }).length;
  const adventurePhotos = (await getAdventurePhotos()) || [];
  const photoChallengeCount = Object.keys(photoChallenges || {}).length;

  return {
    finds,
    seen,
    flags,
    badges,
    xp,
    checkIns,
    photoChallenges,
    collectedIds,
    stats: {
      identified: (await getMeta("identifyCount", 0)) || 0,
      seenTypes: seen.length,
      collectedTypes: collectedIds.length,
      collectedCount: finds.length,
      favorites: finds.filter((f) => f.favorite).length,
      rareCollected: finds.filter((f) => f.rarity === "rare").length,
      ultraCollected: finds.filter((f) => f.rarity === "ultra").length,
      checkInCount: uniqueCheckIns.size,
      fieldTestedFinds,
      outdoorFinds: finds.filter((f) => f.foundOutside && f.foundLocation).length,
      adventurePhotos: adventurePhotos.length,
      photoChallenges: photoChallengeCount,
    },
  };
}

/**
 * Adventure albums — photos grouped by outing (place + date).
 * Shape: {
 *   id, title, placeLabel, placeKey, dateKey (YYYY-MM-DD),
 *   createdAt, updatedAt,
 *   photos: [{ id, dataUrl, note, lat, lng, placeLabel, createdAt }]
 * }
 */
const MAX_ALBUMS = 40;
const MAX_PHOTOS_PER_ALBUM = 30;
const PLACE_CLUSTER_KM = 2.5; // same outing if within ~2.5 km that day

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(dateKey) {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateKey;
  }
}

function haversineKm(a, b) {
  if (a?.lat == null || b?.lat == null) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function placeKeyFrom(placeLabel, lat, lng) {
  if (placeLabel) return placeLabel.toLowerCase().trim().slice(0, 48);
  if (lat != null && lng != null) return `geo_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  return "unknown-place";
}

export async function getAdventureAlbums() {
  let albums = (await getMeta("adventureAlbums", null)) || null;
  if (!albums) {
    // Migrate flat photo list once
    const legacy = (await getMeta("adventurePhotos", [])) || [];
    albums = [];
    for (const p of legacy) {
      const r = await addAdventurePhotoToAlbum(p, { albums, skipSave: true });
      albums = r.albums;
    }
    await setMeta("adventureAlbums", albums);
    if (legacy.length) await setMeta("adventurePhotos", []);
  }
  return albums.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getAdventurePhotos() {
  const albums = await getAdventureAlbums();
  return albums.flatMap((a) => a.photos || []);
}

export async function getAdventureAlbum(id) {
  const albums = await getAdventureAlbums();
  return albums.find((a) => a.id === id) || null;
}

/**
 * Add photo into matching album (same day + nearby place) or create a new outing album.
 */
export async function addAdventurePhoto(entry) {
  const albums = await getAdventureAlbums();
  const { photo, album, albums: next } = await addAdventurePhotoToAlbum(entry, { albums });
  await setMeta("adventureAlbums", next.slice(0, MAX_ALBUMS));
  return { photo, album };
}

async function addAdventurePhotoToAlbum(entry, { albums = [], skipSave = false } = {}) {
  const createdAt = entry.createdAt || Date.now();
  const dateKey = entry.dateKey || dayKey(createdAt);
  const placeLabel = entry.placeLabel || "";
  const lat = entry.lat ?? null;
  const lng = entry.lng ?? null;
  const pKey = placeKeyFrom(placeLabel, lat, lng);

  const photo = {
    id: entry.id || `adv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    dataUrl: entry.dataUrl,
    note: entry.note || "",
    lat,
    lng,
    placeLabel,
    createdAt,
  };

  // Find album: same calendar day + same place key OR within PLACE_CLUSTER_KM
  let album = albums.find((a) => {
    if (a.dateKey !== dateKey) return false;
    if (a.placeKey && pKey && a.placeKey === pKey) return true;
    if (lat != null && a.centroid) {
      return haversineKm(a.centroid, { lat, lng }) <= PLACE_CLUSTER_KM;
    }
    if (!placeLabel && !lat && a.placeKey === "unknown-place") return true;
    return false;
  });

  if (!album) {
    const titlePlace = placeLabel || "Mystery outing";
    album = {
      id: `alb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: `${titlePlace}`,
      subtitle: formatDayLabel(dateKey),
      placeLabel: placeLabel || "",
      placeKey: pKey,
      spotId: entry.spotId || null,
      dateKey,
      centroid: lat != null ? { lat, lng } : null,
      createdAt,
      updatedAt: createdAt,
      photos: [],
    };
    albums = [album, ...albums];
  }

  if (entry.spotId && !album.spotId) album.spotId = entry.spotId;

  album.photos = [photo, ...(album.photos || [])].slice(0, MAX_PHOTOS_PER_ALBUM);
  album.updatedAt = createdAt;
  if (placeLabel && !album.placeLabel) {
    album.placeLabel = placeLabel;
    album.placeKey = pKey;
    album.title = placeLabel;
  }
  if (lat != null) {
    // refresh centroid as average of photo coords
    const pts = album.photos.filter((p) => p.lat != null);
    if (pts.length) {
      album.centroid = {
        lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
        lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
      };
    }
  }
  album.subtitle = formatDayLabel(album.dateKey);

  if (!skipSave) {
    /* caller saves */
  }
  return { photo, album, albums };
}

export async function renameAdventureAlbum(id, title) {
  const albums = await getAdventureAlbums();
  const a = albums.find((x) => x.id === id);
  if (!a) return null;
  a.title = (title || a.title).trim().slice(0, 60);
  a.updatedAt = Date.now();
  await setMeta("adventureAlbums", albums);
  return a;
}

export async function deleteAdventurePhoto(photoId) {
  const albums = await getAdventureAlbums();
  for (const a of albums) {
    a.photos = (a.photos || []).filter((p) => p.id !== photoId);
  }
  const next = albums.filter((a) => (a.photos || []).length > 0);
  await setMeta("adventureAlbums", next);
}

export async function deleteAdventureAlbum(id) {
  const albums = (await getAdventureAlbums()).filter((a) => a.id !== id);
  await setMeta("adventureAlbums", albums);
}

export async function bumpIdentifyCount() {
  const n = ((await getMeta("identifyCount", 0)) || 0) + 1;
  await setMeta("identifyCount", n);
  return n;
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
