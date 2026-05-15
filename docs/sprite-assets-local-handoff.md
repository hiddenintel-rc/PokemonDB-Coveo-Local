# Sprite assets (local) — handoff for AI or engineer

This document is the **single source of truth** for reproducing: (1) a **local static HTTP server** for Pokémon sprite files, and (2) the **Next.js web app** wiring that loads those assets on the **Pokémon detail page** (`/pokemon/[slug]`). Follow it end-to-end to reach the same capability as the current implementation.

**v1 scope (locked):**

- **Local-only sprites** for development and validation. Harden CSP, origins, and hosting **before** treating sprite URLs as a permanent part of the public production app.
- **National Pokédex number only** — all Pokémon DB / index data is expected to expose an accessible national dex (`pokemonnationalnumber` via `nationalDexFromRaw`). No per-form sprite path logic in v1.
- **Sprite binaries stay out of git** — the **`sprites/`** tree lives under **`pokemonDB-master/sprites-master`** (sibling checkout). The **Next.js UI + URL helpers** live in **`web/src/`** (`spriteAsset.ts`, `PokemonSpritePackPanel.tsx`). The optional **`serve`** launcher lives in **`tools/local-sprite-server/`** (safe to commit; no PNG/GIF files).

**Repo boundary:** Large Pokémon data (YAML / DB tooling) and **`sprites-master`** live under a sibling **`pokemonDB-master`** directory on disk. That content is **not** pushed to the **`pokemonDB-SearchCoveo`** GitHub repository. Engineers clone or maintain `pokemonDB-master` separately.

---

## 1. Outcome you must be able to demonstrate

1. With **no** sprite env var set: the web app behaves as before; detail pages show Coveo-backed artwork only.
2. With the **sprite server running** and **`NEXT_PUBLIC_SPRITE_ASSET_BASE_URL`** set: opening a detail page for a species that has a **national Pokédex number** in the Coveo hit shows:
   - Existing **indexed hero image** (unchanged).
   - A **“Sprites”** card with up to three **still PNGs** (official artwork, home, default) via `next/image`.
   - A **Showdown-style animated GIF** via a native **`<img>`** (not `next/image`, so animation is preserved).
3. Missing files for a given dex number **fail gracefully** (tiles disappear, no crash).
4. **`npm run build`** in `web/` completes successfully.

---

## 2. Workspaces on disk

| Location | Role |
|----------|------|
| **`pokemonDB-SearchCoveo/web/`** | Next.js 16 app; sprite UI in **`src/lib/spriteAsset.ts`** + **`src/components/pokemon/PokemonSpritePackPanel.tsx`**. |
| **`pokemonDB-SearchCoveo/tools/local-sprite-server/`** | Optional **`serve`** script (committed; no binaries). Run locally; see §4. |
| **`pokemonDB-master/sprites-master/`** (sibling folder, **not** in SearchCoveo git) | **`sprites/`** tree (PNG/GIF). |
| **`pokemonDB-master/`** (other paths) | DB / YAML / tooling — **not** committed to SearchCoveo; document only. |

Example layout:

```text
D:\Coding Projects\
  pokemonDB-SearchCoveo\     ← this repo (web app + docs)
  pokemonDB-master\        ← separate checkout; not pushed to SearchCoveo GitHub
    sprites-master\
      sprites\             ← HTTP root for Phase A (see §3)
    …                      ← database / YAML / tooling as maintained by your team
```

---

## 3. Expected on-disk sprite layout (under `sprites-master/sprites/`)

The web app builds URLs from the **national Pokédex integer** `N` (e.g. `25` for Pikachu). The static server’s **HTTP root must be the contents of `sprites/`** so these paths resolve:

| Relative URL | File purpose |
|----------------|--------------|
| `/pokemon/{N}.png` | Default sprite |
| `/pokemon/other/official-artwork/{N}.png` | Official-style still |
| `/pokemon/other/home/{N}.png` | “Home” still |
| `/pokemon/other/showdown/{N}.gif` | Animated battle sprite |

Other folders (`types/`, `items/`, `badges/`, `versions/`, …) may exist but are **not** required for this handoff.

---

## 4. Phase A — Local static server (`serve` only, no asset copy in git)

We **do not** commit `sprites/` into `pokemonDB-SearchCoveo`. Use either:

### Option A — `tools/local-sprite-server` (committed; recommended)

From **`pokemonDB-SearchCoveo/tools/local-sprite-server/`** (after `npm install`):

```bash
npm run serve
```

This runs **`serve`** on **`sprites-master/sprites`**, defaulting to a **sibling** path  
`…/pokemonDB-master/sprites-master/sprites`. Override with **`SPRITES_DIR`**. See **`tools/local-sprite-server/README.md`**.

> A legacy path **`web/pokemon-asset-hosted/`** is listed in **`.gitignore`** — do not commit it; use Option A instead.

### Option B — `npx` from `sprites-master`

From the machine that has **`pokemonDB-master/sprites-master`**:

1. Install **`serve`** once (global or local — your choice). Example: **`serve` ^14.2.x** as a dev dependency in `sprites-master/package.json` if you prefer.
2. From **`sprites-master`**, the **`sprites`** subdirectory must be the directory served at the URL root.

**Commands (illustrative — adjust path to your clone):**

```bash
cd "D:/Coding Projects/pokemonDB-master/sprites-master"
npx --yes serve@^14.2.4 sprites -l tcp://127.0.0.1:8787 -n
```

Expected log line: **accepting connections at `http://127.0.0.1:8787`**.

`-l tcp://127.0.0.1:8787` binds to loopback (not all interfaces). `-n` disables opening the clipboard.

### Smoke tests (browser or curl)

These must return **200** and correct `Content-Type`:

- `http://127.0.0.1:8787/pokemon/25.png` → `image/png`
- `http://127.0.0.1:8787/pokemon/other/showdown/25.gif` → `image/gif`
- `http://127.0.0.1:8787/pokemon/other/official-artwork/25.png` → `image/png`

**CORS:** not required for `<img src>` / `next/image` from another localhost port.

---

## 5. Phase B — Web app (`pokemonDB-SearchCoveo/web`)

### 5.1 Environment variable

In **`web/.env.local`** or **`web/.env`** (never commit secrets; document in **`web/.env.example`**):

```bash
# Must match the static server origin exactly (scheme + host + port).
NEXT_PUBLIC_SPRITE_ASSET_BASE_URL=http://127.0.0.1:8787
```

**Important:** If the static server listens on **`127.0.0.1`**, do not use **`localhost`** in this URL unless you also change the server and all CSP-derived origins to match. **Mismatch breaks `img-src` and `remotePatterns`.**

Coveo variables (`NEXT_PUBLIC_COVEO_*`) are unchanged; the sprite URL is **additive**.

### 5.2 Source files and responsibilities

Implement or verify the following **exact responsibilities** (paths relative to `web/`):

| File | Responsibility |
|------|----------------|
| **`src/lib/spriteAsset.ts`** | `spriteAssetBaseUrl()`, `normalizedSpriteAssetBase()`, `isSpriteAssetUrl(src)`, `buildSpritePackUrls(nationalDex)`. |
| **`src/components/pokemon/PokemonSpritePackPanel.tsx`** | Client component: if base URL unset, render `null`. Three stills (`next/image`) + GIF (`<img>`). `compact` prop for detail sidebar. |
| **`src/components/pokemon/PokemonIndexedImage.tsx`** | Allow `src` if pokemondb/Coveo HTTPS **or** `isSpriteAssetUrl(src)` from **`@/lib/spriteAsset`**. |
| **`src/components/pokemon/PokemonDetailView.tsx`** | Embeds **`PokemonSpritePackPanel`** in the main card when **`nationalDex != null`** and **`spriteAssetBaseUrl()`** is set. |
| **`src/proxy.ts`** | Append sprite **origin** to **`img-src`** when env set. **Development:** omit **`upgrade-insecure-requests`**. **Production:** keep it when all image origins are HTTPS. |
| **`next.config.ts`** | Parse `NEXT_PUBLIC_SPRITE_ASSET_BASE_URL` for **`remotePatterns`**; in dev, **`127.0.0.1:8787`** is also whitelisted for `next/image` (see file). |

### 5.3 Data dependency (detail “Sprites” card visibility)

The Sprites card is keyed off **`nationalDexFromRaw`** (`web/src/lib/nationalDex.ts`), which reads Coveo `raw` fields such as **`pokemonnationalnumber`**. If the index document has **no** national dex field populated, the panel **will not mount** (by design), even if the sprite server is up.

---

## 6. Run order for validation (local)

1. Start sprites: **`tools/local-sprite-server`** → `npm install` then `npm run serve` (or Option B in §4). Ensure **`pokemonDB-master/sprites-master/sprites`** exists or set **`SPRITES_DIR`**.
2. Set `NEXT_PUBLIC_SPRITE_ASSET_BASE_URL=http://127.0.0.1:8787` in **`pokemonDB-SearchCoveo/web/.env.local`**.
3. Start app: **`pokemonDB-SearchCoveo/web`** → `npm run dev`.
4. Navigate to **`/pokemon/pikachu`** (or any slug with indexed national number and sprite files present under `sprites/pokemon/...`).
5. Confirm Sprites card + animation.
6. Run **`npm run build`** in **`web/`**.

---

## 7. After v1 — hardening and optional one-off demo

**Production default:** Do **not** point the live Vercel app at **`http://127.0.0.1:…`** — visitors’ browsers cannot reach your laptop. Shipping sprites on the public site requires at minimum:

- Same **`sprites/`** tree behind **HTTPS** (CDN, object storage, or static host).
- **`NEXT_PUBLIC_SPRITE_ASSET_BASE_URL`** set to that **`https://…`** origin.
- Redeploy so **`next.config.ts`** picks up **`remotePatterns`** and **`proxy.ts`** extends **`img-src`** for that origin. Production keeps **`upgrade-insecure-requests`** when every image origin is HTTPS.

**Temporary demo (explicitly out of band):** A one-time demo that “surfaces” extra assets from a machine you control usually means a **tunnel** (e.g. ngrok, Cloudflare Tunnel) or a **throwaway HTTPS URL**, not raw `http://127.0.0.1` in production env vars. Stop the tunnel and sprite **`serve`** process when the demo ends. Treat any public URL as sensitive for the duration of the demo (rate limits, abuse, CSP review).

---

## 8. GitHub + Vercel — what ships, what stays on your machine

| Topic | Detail |
|-------|--------|
| **Safe to push** | `web/src/lib/spriteAsset.ts`, `web/src/components/pokemon/PokemonSpritePackPanel.tsx`, `web/next.config.ts`, `web/src/proxy.ts`, and **`tools/local-sprite-server/`** (Node + `serve` only — **no** PNG/GIF files). |
| **Do not push** | Sprite binaries (`pokemonDB-master/...`), real API keys, **`.env.local`**. Root **`.gitignore`** includes **`web/pokemon-asset-hosted/`** so a stale local folder is never committed. |
| **Vercel build** | Succeeds **without** `NEXT_PUBLIC_SPRITE_ASSET_BASE_URL`. The sprite column simply does not render until you set the env. |
| **`http://127.0.0.1:8787` on production** | **Does not load for normal visitors.** In each user’s browser, `127.0.0.1` is **their** machine, not yours. Your laptop sprite server is only reachable from **your** browser while **you** run `npm run serve` locally and use `localhost:3000` (or similar) with matching env. |
| **Sprites visible on the public `*.vercel.app` site** | Host the same **`sprites/`** tree at an **HTTPS** URL the internet can reach (S3 static site, Cloudflare R2 + public bucket, GitHub Pages on a throwaway repo, etc.). In **Vercel → Project → Settings → Environment Variables**, set **`NEXT_PUBLIC_SPRITE_ASSET_BASE_URL`** to that **`https://…`** origin (Production + Preview as needed) and **redeploy** so `next.config.ts` adds **`remotePatterns`** and CSP **`img-src`** picks it up at build/request time. |

---

## 9. Troubleshooting checklist

| Symptom | Likely cause |
|---------|--------------|
| Sprites card never appears | Env unset, wrong env file location (`web/.env.local`), or missing national dex in Coveo `raw`. |
| Broken image icon / CSP violation in console | `NEXT_PUBLIC_SPRITE_ASSET_BASE_URL` origin not added to **`img-src`** in `proxy.ts`, or host/port typo vs running server. |
| `next/image` error “hostname not configured” | Missing or wrong **`remotePatterns`** in **`next.config.ts`** for that origin; restart dev server after env change. |
| HTTP sprite URL blocked in dev | **`upgrade-insecure-requests`** still present in dev CSP — remove for development only. |
| GIF does not animate | Do **not** use `next/image` for the GIF; use **`<img>`**. |

---

## 10. Version pins (reference)

As implemented alongside this work: **Next.js 16.2.x**, **`serve` ^14.2.x**. Newer versions may work; if something breaks, compare against these pins first.

---

*End of handoff document.*
