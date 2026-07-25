# Deploy Rock Quest Oahu on Netlify

The app is a **static PWA** plus small **serverless functions** for rock ID (xAI vision).  
Netlify gives you **HTTPS**, which phones need for **camera** and **location**.

---

## Before you start

1. A **Netlify** account (you already have one).
2. An **xAI API key** from [console.x.ai](https://console.x.ai) (for Identify).
3. This project folder: `rock-quest` (with `netlify.toml` and `netlify/functions/`).

**Do not upload your `.env` file.** On Netlify you set the key in the website settings instead.

---

## Option A — Deploy from GitHub (recommended)

### 1) Put the project on GitHub

On your Mac, in Terminal:

```bash
cd ~/rock-quest
git init
git add .
git status   # confirm .env is NOT listed
git commit -m "Rock Quest Oahu ready for Netlify"
```

Create a new empty repo on GitHub (e.g. `rock-quest-oahu`), then:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rock-quest-oahu.git
git push -u origin main
```

(Use your real GitHub username/repo URL.)

### 2) Connect the repo in Netlify

1. Open [app.netlify.com](https://app.netlify.com)
2. **Add new site** → **Import an existing project**
3. Choose **GitHub** and authorize if asked
4. Select the **rock-quest-oahu** repo
5. Build settings (should auto-detect from `netlify.toml`):
   - **Build command:** leave as in `netlify.toml` (or blank / the echo command)
   - **Publish directory:** `.` (site root)
   - **Functions directory:** `netlify/functions`
6. Click **Deploy site**

### 3) Add your vision API key

1. In Netlify: open the new site
2. **Site configuration** → **Environment variables**
3. **Add a variable**
   - Key: `XAI_API_KEY`
   - Value: your `xai-...` key from console.x.ai
4. Save
5. **Deploys** → **Trigger deploy** → **Deploy site** (so functions see the new key)

### 4) Get your live HTTPS link

1. Site overview shows something like:  
   `https://random-name-123.netlify.app`
2. Optional: **Domain management** → change to a nicer name  
   e.g. `rock-quest-oahu.netlify.app`

Open that **https://** link on your phone (any network — not only home Wi‑Fi).

---

## Option B — Drag and drop (quick, no Git)

1. On your Mac, open Finder → `rock-quest` folder  
2. **Remove or hide `.env`** from the folder you upload (do not publish the key as a file)
3. In Netlify: **Add new site** → **Deploy manually** → drag the **whole folder**
4. After deploy, still add **Environment variable** `XAI_API_KEY` (step 3 above) and **redeploy**

Note: Functions work best with Git deploys; if Identify fails after drag-drop, use Option A.

---

## After deploy — phone checklist

| Feature | What to do |
|--------|------------|
| **Open app** | Safari/Chrome → your `https://….netlify.app` link |
| **Camera** | Tap Identify / Add photo → Allow camera |
| **Location** | Explore → Use my location → Allow |
| **Install** | iPhone: Share → Add to Home Screen |
| **Identify rocks** | Works only if `XAI_API_KEY` is set in Netlify and site was redeployed |

HTTPS is automatic on Netlify — that’s what unlocks camera + GPS on phones.

---

## Local vs live

| | Local Mac | Netlify live |
|--|-----------|--------------|
| Run | `python3 server.py` → `http://localhost:8787` | Always on at your Netlify URL |
| API key | `.env` file | Environment variables in Netlify |
| Camera/GPS | Works on `localhost`; on phone use LAN IP only on same Wi‑Fi | Works from anywhere on **https://** |

---

## Troubleshooting

- **Identify says needs key** → `XAI_API_KEY` missing; add env var and redeploy  
- **Camera blocked** → must use `https://` (or localhost), not `http://`  
- **Location blocked** → allow Location for Safari/Chrome for that site  
- **Identify times out** → free Netlify functions max ~10s; try a smaller/clearer photo, or upgrade plan for longer timeouts  
- **Old look after update** → hard-refresh or clear site data; service worker cache bumps on new deploys  

---

## Files that make deploy work

- `netlify.toml` — publish root, functions, `/api/*` redirects, security headers  
- `netlify/functions/status.js` — `/api/status`  
- `netlify/functions/identify.js` — `/api/identify` (xAI vision)  
- `netlify/functions/set-key.js` — explains keys must be set in Netlify (not from the phone)  
- `_headers` — camera + geolocation permissions policy  
