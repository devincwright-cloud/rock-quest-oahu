# Rock Quest Oahu 🪨✨

A fun, kid-friendly **Progressive Web App** for collecting rocks and minerals across **Oahu** — like a Rock Dex island adventure.

Kids take photos of rocks, get AI-powered identification, save finds, earn adventure badges, and discover real places to explore with unique rock-hunt missions.

## Features

- **Camera ID** — snap or upload a photo → top guesses, rarity stars, kid facts, field tips
- **Rock Dex** — Seen / Collected library, nicknames, notes, favorites (local-first per device)
- **Explore Nearby** — Short / Medium / Longer range suggestions + public spots
- **Badges & Levels** — Rock Ranger → Crystal Master path + side quest badges
- **PWA** — install to home screen; collection works offline after first load

## Quick start (Mac)

```bash
cd ~/rock-quest

# 1) Enable REAL rock vision (required for Identify)
#    Get a key: https://console.x.ai
cp .env.example .env
# edit .env → XAI_API_KEY=xai-...

# 2) Start server (static app + /api/identify proxy)
python3 server.py
```

Or paste the key in the **Identify** screen setup box (saves to `.env` automatically).

## Deploy on Netlify (phones + HTTPS)

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step instructions.

Summary:
1. Push this folder to GitHub (keep `.env` out of git)
2. Netlify → Import repo → deploy
3. Site settings → Environment variables → `XAI_API_KEY`
4. Redeploy → open the **https://….netlify.app** link on your phone

Then open:

- http://localhost:8787

**On your phone (same Wi‑Fi):**

1. Find your Mac’s IP (`ipconfig getifaddr en0`)
2. Open `http://YOUR_IP:8787`
3. Gallery upload works if camera is blocked on HTTP
4. **Add to Home Screen** for the PWA feel

**Without `XAI_API_KEY`:** Identify shows a clear setup message (it will **not** invent the same 3 rocks).

## Architecture

```
rock-quest/
  index.html          # App shell
  manifest.json       # PWA install
  sw.js               # Service worker (offline shell + static cache)
  server.py           # Static files + vision API proxy
  css/styles.css
  js/
    app.js            # Router + screen wiring
    store.js          # IndexedDB Rock Dex
    identify.js       # Camera + vision client
    badges.js         # Levels & badge unlocks
    explore.js        # Nearby rocks + public spots
    ui.js             # Shared UI helpers
    data/
      catalog.js      # Rock types & rarity
      spots.js        # Public geology-friendly places (esp. Hawaii)
      badges-data.js  # Badge definitions
```

- **Local-first:** IndexedDB (`RockQuestDB`) stores finds, favorites, badges, level XP
- **No accounts / ads / paywalls** for core play
- **Vision:** browser → `POST /api/identify` → SpaceXAI (`api.x.ai`) with a kid-safe geology system prompt
- Easy to swap vision backend later (change only `server.py` + `identify.js`)

## Privacy

- Photos are sent only when you tap **Identify** (to the local proxy, then to the vision API if configured)
- Collection stays on the device unless you add a backend later
- Location is optional and used only for nearby suggestions

## Tips for parents

- Collect only on **public land** where it’s allowed; leave special places as you found them
- Never climb cliffs or enter water for rocks
- AI guesses can be wrong — treat them as learning clues, not lab IDs

Have fun exploring! 🗺️💎
