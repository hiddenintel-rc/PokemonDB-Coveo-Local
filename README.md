# Pokémon Search — Coveo Headless + Next.js

A Coveo-powered search experience over **pokemondb.net** species pages, built with **`@coveo/headless`**, **Next.js** (App Router), and TypeScript. The application package lives under **`web/`** (`"name": "web"`), separate from the repo root.

**Documentation:** [`docs/README.md`](./docs/README.md) — architecture, design decisions, Coveo admin playbook, platform notes, and security reviews.

**Current stack** (from `web/package.json`): Next.js **16.2.x**, React **19.2.x**, Tailwind CSS **4.x**, `@coveo/headless` **^3.50.1**.

---

## Overview

The browser talks to **Coveo Cloud** using an Anonymous Search API key in development (or the same **`NEXT_PUBLIC_*`** variables in production). Headless controllers power the search box (with query suggestions), string and numeric facets, the result list, optional **Relevance Generative Answering**, and per-result **`documentClick`** events for **Automatic Relevance Tuning**. The **`/pokemon/[slug]`** route loads one species document via **`fetch-pokemon-by-slug.ts`** so detail views do not reset the home search session or emit extra search analytics.

---

## Features

- **Search & facets** — type, generation, ability, and base stat total (five labeled BST tiers).
- **Result cards** — artwork from `pictureuri` / fallbacks, national Pokédex number when indexed, BST, type pills; cards link to **`/pokemon/{slug}`** and emit **`documentClick`** for ART.
- **Generative answering** — RGA panel with citations and feedback when the pipeline returns an answer.
- **Detail page** — types, generation, abilities, base stats, external link to pokemondb; same catalog layout as search.
- **Coveo org configuration** — Web source, scraping rules, fields, featured results, and ML models (QS, RGA, ART) are described in **`docs/`** and **`.cursor/rules/coveo-indexing.mdc`**. **Playwright ML warm-up / smoke automation is intentionally not in this repository** (see `.gitignore` under `tools/`); use manual searches in the live app or your own scripts if you need to feed QS/ART.

---

## Local Development Setup

### Prerequisites
- Node.js 20.9.0+
- Access to a Coveo organization with a Web source and API credentials for search (see **`docs/coveo-admin-playbook.md`**).

### Environment Variables

1. In **`web/`**, copy **`.env.example`** and create **`.env`** or **`.env.local`** with real values (both are gitignored; never commit credentials). The in-app “env missing” banner mentions `.env.local`, which matches common Next.js usage.
2. Fill in `NEXT_PUBLIC_COVEO_ORG_ID` and `NEXT_PUBLIC_COVEO_API_KEY` at minimum.

```bash
NEXT_PUBLIC_COVEO_ORG_ID=your_organization_id
NEXT_PUBLIC_COVEO_API_KEY=your_api_key
# Optional; defaults to PokemonSearch — must match Search hub enforced on the API key, if any
NEXT_PUBLIC_COVEO_SEARCH_HUB=PokemonSearch
```

For **production**, set the same variable names in your host’s dashboard (e.g. Vercel **Environment Variables**), not in git.

> Keys: Coveo Admin Console → API Keys → Anonymous search template (public content only).

### Install & Run

```bash
cd web
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

**Optional — Coveo ML warm-up:** Not part of the `web/` install. This public clone does **not** ship Playwright automation; run representative searches and clicks in the app yourself, or add a private `tools/` package locally (see [docs/coveo-admin-playbook.md](./docs/coveo-admin-playbook.md) §3 Phase 4 for what events matter).

---

## Deployment (GitHub → Vercel)

The live search app is delivered by **pushing this repository to GitHub**, then **building and deploying the Next.js app on Vercel** when `main` updates (or when you trigger a redeploy).

### Flow

1. **Develop and commit** in `web/` (and the rest of the repo as needed).
2. **Push to GitHub** — e.g. `git push origin main`.
3. **Vercel** — the project is **imported from the same GitHub repo**. Each push to **`main`** should create a **new** deployment row for the **new commit**. (See *If production still shows an old commit* below.)

### If production still shows an old commit

Vercel’s **Redeploy** on an **existing** deployment row rebuilds **that row’s Git commit** — it does **not** automatically jump to the latest `main`. If the dashboard still shows e.g. `b4dc1ef` after you pushed `af35c76`, you likely redeployed an old deployment.

1. Open **Deployments** and select the **top** row (newest by time). Its commit message and SHA should match [the latest commit on `main`](https://github.com/hiddenintel-rc/PokemonDB-Coveo-Local/commits/main) for this repo.
2. Under **Project → Settings → Git**, confirm the **Connected Repository** is **`hiddenintel-rc/PokemonDB-Coveo-Local`** (or whichever repo you actually `git push` to) and the **Production Branch** is **`main`**.
3. If new pushes never appear as new deployments, disconnect/reconnect Git or check GitHub **Settings → Webhooks** for the repo (Vercel should receive `push` events).
4. To force a build from **current** `main` without hunting the UI: push **any** new commit to `main` (even a no-op docs tweak); that creates a fresh deployment from HEAD.

After a correct deploy, the search page shows a small **Git build `xxxxxxx`** line at the bottom (first seven characters of `VERCEL_GIT_COMMIT_SHA`); it should match the short SHA on GitHub for that deployment.

### Vercel project settings (required for this monorepo)

This repo’s Next.js app is **not** at the repository root; it lives under **`web/`**. If these are wrong, the deployment can succeed with almost no output and show **404** at `/`.

| Setting | Value |
|--------|--------|
| **Root Directory** | `web` |
| **Framework Preset** | **Next.js** (not “Other”) |
| **Node.js Version** | **20.x** or **22.x** (LTS) is recommended; redeploy after changing. |

After changing Root Directory or Framework, trigger a **Redeploy** so the new settings apply to a full build.

### Environment variables on Vercel

Add the same **`NEXT_PUBLIC_*`** variables as in local `web/.env.local` (at minimum org ID and API key). Vercel → Project → **Settings → Environment Variables** → scope **Production** (and **Preview** if you use PR previews). Redeploy after edits.

### Example production URL

- Example deployment: [https://pokemon-db-coveo-local.vercel.app/](https://pokemon-db-coveo-local.vercel.app/) — replace with your production URL when sharing the app.

For architecture context (Coveo vs app hosting), see [`docs/architecture.md`](./docs/architecture.md) §5.

### Production security (live site)

The `web/` app ships with **nonce-based Content-Security-Policy** (`src/proxy.ts`), **HTTP headers** and **`next/image` allowlists** in `next.config.ts`, and **`PokemonIndexedImage`** so only known HTTPS artwork hosts load in the UI. Details: [`docs/security-review.md`](./docs/security-review.md). **OWASP Top 10 deployment mapping** and `npm audit`: [`docs/owasp-deployment-review.md`](./docs/owasp-deployment-review.md).

---

## Repository presentation (GitHub)

If the repository is **public**, set the GitHub **Description** and **Topics** to neutral, technical wording (stack + domain). The **Description** is edited on GitHub under **Repository → ⚙ Settings** (not in git).
|---|---|
| Coveo Admin Console | https://platform.cloud.coveo.com/admin/ |
| Coveo Docs | https://docs.coveo.com |
| Headless Docs | https://docs.coveo.com/en/headless/latest/reference/documents/index.html |
| Headless Getting Started | https://docs.coveo.com/en/headless/latest/reference/documents/getting-started/getting-started-search.html |
| Headless React Sample | https://github.com/coveo/ui-kit/tree/main/samples/headless/search-react |
| Coveo CLI | https://github.com/coveo/cli#readme |
| Web Scraping Config Guide | https://docs.coveo.com/en/1580/ |
| Fields in Coveo | https://docs.coveo.com/en/1833/ |

---

## Architecture Notes

- Search UI is client-only (`SearchInterface`); **`coveoConfigured()`** gates rendering so the engine is only used when org ID and API key are non-empty — `next build` succeeds without secrets.
- Engine and controllers are singletons (`web/src/coveo/search-instance.ts`); subscribe via the generic `useCoveoController(controller)` hook.
- Controllers in use: `buildSearchBox` (with QS), `buildResultList` (with `fieldsToInclude`), three `buildFacet`s (type / generation / ability), one `buildNumericFacet` (BST, 5 fixed tier ranges driven by `BST_TIERS`), `buildGeneratedAnswer` (RGA), and a per-card `buildInteractiveResult` for `documentClick` analytics.
- Detail route at `/pokemon/[slug]` bypasses the engine for its data fetch (`fetch-pokemon-by-slug.ts`) so detail loads don't emit `search` analytics or mutate the home page's engine state.

For the full architecture diagram and runtime boundaries, see [`docs/architecture.md`](./docs/architecture.md). For design rationale, [`docs/design-decisions.md`](./docs/design-decisions.md). For a **security pass** (Vercel env vars, no custom backend in `web/`, headers, CSP), see [`docs/security-review.md`](./docs/security-review.md). For **OWASP Top 10:2021** validation of the deployment (including known dependency findings), see [`docs/owasp-deployment-review.md`](./docs/owasp-deployment-review.md).

---

## pokemondb.net Field Mapping

| Data | HTML Location | Coveo field | UI surface |
|---|---|---|---|
| Pokémon name | `<h1>` title | `title` (default) | Card title + detail-page heading |
| Page URL | Page URI | `uri` / `clickUri` (default) | Detail-page slug derivation + RGA citation links |
| Type(s) | `main table.vitals-table:first-of-type` → Type row → `a.type-icon` | `pokemontype` (String, multi-value) | Type facet + card "Types: …" line |
| Generation | Intro paragraph `<abbr>` | `pokemongeneration` (String) | Generation facet + card |
| Ability | `a[href^="/ability/"]` links in Pokédex data table | `pokemonability` (String, multi-value; semicolon-joined when index stores as single string) | Ability facet + card "Abilities: …" line |
| Image / sprite | `<meta property="og:image">` | `pictureuri` (fallbacks: `picture_uri`, `syspictureuri`) | Card thumbnail + detail-page hero image |
| BST (Total) | `#dex-stats ~ div.resp-scroll tfoot td.cell-num:first-of-type` | `pokemonbst` (Integer 32) | **"Base stat total" facet** (five labeled tiers) + sky BST line on each search-result card + **detail page** stats total row (with tier label) |
| HP, Attack, Defense, Sp. Atk, Sp. Def, Speed | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(N) td.cell-num:first-of-type` | `pokemonhp`, `pokemonattack`, `pokemondefense`, `pokemonspatk`, `pokemonspdef`, `pokemonspeed` (Integer 32) | **Detail page** base-stats bar chart (value + proportional bar, scaled to 255) — not faceted or sorted in search results |
