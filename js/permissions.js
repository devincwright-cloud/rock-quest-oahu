/**
 * Camera + location helpers that respect browser permission grants
 * and avoid re-prompting every session when already allowed.
 */

const LOC_KEY = "rq_oahu_loc_ok";
const CAM_KEY = "rq_oahu_cam_ok";
const LAST_LOC_KEY = "rq_oahu_last_loc";

export function markLocationGranted() {
  try {
    localStorage.setItem(LOC_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function markCameraGranted() {
  try {
    localStorage.setItem(CAM_KEY, "1");
  } catch {
    /* */
  }
}

export function wasLocationGrantedBefore() {
  try {
    return localStorage.getItem(LOC_KEY) === "1";
  } catch {
    return false;
  }
}

export function wasCameraGrantedBefore() {
  try {
    return localStorage.getItem(CAM_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLastLocation(loc) {
  if (!loc || loc.lat == null) return;
  try {
    localStorage.setItem(
      LAST_LOC_KEY,
      JSON.stringify({
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy ?? null,
        at: Date.now(),
      })
    );
  } catch {
    /* */
  }
}

export function loadLastLocation(maxAgeMs = 30 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(LAST_LOC_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.lat == null || o.lng == null) return null;
    if (Date.now() - (o.at || 0) > maxAgeMs) return null;
    return o;
  } catch {
    return null;
  }
}

/** Query Permissions API when available (not all browsers support geolocation name). */
export async function queryPermission(name) {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const st = await navigator.permissions.query({ name });
    return st.state; // granted | denied | prompt
  } catch {
    return "unknown";
  }
}

/**
 * Get GPS. Uses fresher fix for check-ins; can fall back to last known.
 * @param {{ timeout?: number, maximumAge?: number, highAccuracy?: boolean, allowCached?: boolean }} [opts]
 */
export function getPosition(opts = {}) {
  const timeout = opts.timeout ?? 18000;
  const maximumAge = opts.maximumAge ?? 20_000;
  const enableHighAccuracy = opts.highAccuracy !== false;
  const allowCached = opts.allowCached !== false;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        markLocationGranted();
        saveLastLocation(loc);
        resolve(loc);
      },
      (err) => {
        if (allowCached) {
          const last = loadLastLocation();
          if (last) {
            resolve({ ...last, stale: true });
            return;
          }
        }
        reject(err);
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  });
}

/** Continuous updates while on a hike / adventure */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError?.(new Error("Location not available"));
    return null;
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const loc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      markLocationGranted();
      saveLastLocation(loc);
      onUpdate?.(loc);
    },
    (err) => onError?.(err),
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 25000 }
  );
  return id;
}

export function clearWatch(id) {
  if (id != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(id);
  }
}

/**
 * Open camera without re-prompt when already granted.
 * Supports facingMode + optional zoom (device-dependent).
 */
export async function openCameraStream({
  facingMode = "environment",
  zoom = 1,
} = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera not available on this device.");
  }
  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  markCameraGranted();

  // Apply zoom if the track supports it
  try {
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.() || {};
    if (caps.zoom) {
      const min = caps.zoom.min ?? 1;
      const max = caps.zoom.max ?? 1;
      const z = Math.min(max, Math.max(min, zoom));
      await track.applyConstraints({ advanced: [{ zoom: z }] });
    }
  } catch {
    /* zoom not supported — OK */
  }
  return stream;
}

export async function applyZoom(stream, zoom) {
  if (!stream) return { ok: false, reason: "no stream" };
  try {
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.() || {};
    if (!caps.zoom) return { ok: false, reason: "unsupported", min: 1, max: 1 };
    const min = caps.zoom.min ?? 1;
    const max = caps.zoom.max ?? 1;
    const z = Math.min(max, Math.max(min, zoom));
    await track.applyConstraints({ advanced: [{ zoom: z }] });
    return { ok: true, zoom: z, min, max };
  } catch (e) {
    return { ok: false, reason: e.message || "failed" };
  }
}

export function getZoomRange(stream) {
  try {
    const track = stream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.() || {};
    if (!caps.zoom) return { supported: false, min: 1, max: 1, current: 1 };
    const settings = track.getSettings?.() || {};
    return {
      supported: true,
      min: caps.zoom.min ?? 1,
      max: caps.zoom.max ?? 1,
      current: settings.zoom ?? 1,
    };
  } catch {
    return { supported: false, min: 1, max: 1, current: 1 };
  }
}
