/**
 * Location helpers for outdoor finds (not used for vision ID).
 */

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&format=json&zoom=12`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Nominatim asks for a valid identifying UA
        "User-Agent": "RockQuest/1.0 (kids geology PWA; local-first)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const place =
      a.suburb ||
      a.neighbourhood ||
      a.village ||
      a.town ||
      a.city ||
      a.county ||
      a.state ||
      a.country ||
      null;
    const label =
      data.display_name?.split(",").slice(0, 3).join(", ").trim() ||
      place ||
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return { placeName: place || label, label, raw: data.display_name || label };
  } catch {
    return null;
  }
}

export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return "";
  return `${Number(lat).toFixed(4)}°, ${Number(lng).toFixed(4)}°`;
}

/** OpenStreetMap embed URL for a small map */
export function osmEmbedUrl(lat, lng, delta = 0.02) {
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmLink(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
}
