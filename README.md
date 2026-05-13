# Pokemon Search Challenge — Coveo + React

A Coveo-powered search page built with `@coveo/headless`, **Next.js** (App Router), and TypeScript. The deliverable UI lives in **`web/`** as its own npm package (`"name": "web"`), separate from the repo root.

**Architecture and Coveo integration docs:** see the [`docs/`](./docs/README.md) folder (solution-architect oriented).

**Current stack (from `web/package.json`):** Next.js **16.2.x**, React **19.2.x**, Tailwind CSS **4.x**, `@coveo/headless` **^3.50.1**.

---

## Official challenge checklist (Pre-Sales 2026 brief)

This section tracks the **Pokémon Challenge (Pre-Sales, 2026)** document line-by-line: **Goals**, **Essential**, **Intermediate**, **Advanced**, **Bonus**.

**Legend**

| Tag | Meaning |
|-----|---------|
| **[App]** | Implemented in this repository (`web/` Next.js + Headless). Update these boxes when the code changes. |
| **[Org]** | Your Coveo Cloud org (Admin Console: sources, fields, crawl/scrape, API keys). Not stored in git—tick when **your** environment satisfies the item. |
| **[Ship]** | Submission deliverables (GitHub, hosting, slides, interviews). |

### Goals

> *"The main goal will be to index pokemondb.net and customize your search page to include certain features."*

- [x] **[Org]** Index **pokemondb.net** with your Coveo org — Web source `PokemonDB Crawl` in `roelc_Pokemon`.
- [x] **[App]** Customize the **local search page** (facets, images, BST chip, detail route, Headless wiring — see `web/src/`).

### Essential

> *"ESSENTIAL" section of the challenge brief.*

- [x] **[Org]** Accept the Coveo Cloud Organization invitation.
- [x] **[App]** **Install Headless locally** — `@coveo/headless ^3.50.1` in `web/` (this repo uses **Headless**, not Atomic).
- [x] **[Org]** **Index (crawl) pokemondb.net** via cloud Web source.
  - [x] **[Org]** **Include only actual Pokémon pages** — inclusion regex `^https://pokemondb\.net/pokedex/[a-z0-9-]+$` plus exclusion rules for `/move/`, `/moves/`, `/type/`, `/ability/`, `/item/`, `/mechanic/`, `/pokebase/`, `/evolution/`. See [`.cursor/rules/coveo-indexing.mdc`](./.cursor/rules/coveo-indexing.mdc).
- [x] **[Org]** **Web scraping configuration** — 11 metadata extractors (4 String + 7 Integer 32). Selectors verified against Golbat (BST sum identity holds: `75+80+70+65+75+90 = 455`) and against multi-form species Charizard (534, not 634) and Mewtwo (680, not 780). Full selector set in [`coveo-admin-playbook.md`](./docs/coveo-admin-playbook.md).
- [x] **[Org]** **Custom fields** — all 11 created and facet-/sort-configured in Admin. See [`.cursor/rules/coveo-indexing.mdc`](./.cursor/rules/coveo-indexing.mdc) for the schema table.
- [x] **[App]** **Connect search page to cloud endpoint** — `NEXT_PUBLIC_COVEO_*` env vars + Headless engine (`web/src/coveo/search-instance.ts`).
- [x] **[App]** **Type facet** (`pokemontype`, 25 values, multi-value).
- [x] **[App]** **Generation facet** (`pokemongeneration`, 15 values).
- [x] **[App]** **Display Pokémon picture in each search result** — image fallback chain `pictureuri` → `picture_uri` → `syspictureuri` in `result.raw`.

**Application details**

- Next.js (App Router) + TypeScript under `web/`.
- Search box with Query Suggestions combobox, result list, initial `executeFirstSearch()`, **`coveoConfigured()`** guard so `next build` works without Coveo secrets.
- Four facets: type, generation, ability, BST (numeric with 5 labeled tiers).
- RGA-generated answer panel with citations + 👍/👎 feedback above the result list.
- Each card is a Next.js `<Link>` to `/pokemon/[slug]` and emits a `documentClick` analytics event via `buildInteractiveResult` (ART training signal).
- **Detail page** (`PokemonDetailView`): same **catalog** background and centered sheet as search; Coveo-backed slug fetch; stacked **Stats** card — see `docs/application-components.md` and **DD-16** in `docs/design-decisions.md`.

### Intermediate

> *"INTERMEDIATE" section of the challenge brief.*

- [x] **[Ship]** **Host your code on GitHub** — push `main` to your remote; reviewers clone or browse the repo.
- [x] **[Ship]** **Host your search app** — production build is wired through **Vercel** connected to that repo (see [Deployment (GitHub → Vercel)](#deployment-github--vercel) below). Replace the example URL with yours when sharing externally.

### Advanced

> *"ADVANCED" section of the challenge brief.*

- [x] **[Org]** **Deploy Coveo RGA** — `pokemon_RGA` model created and associated to the default pipeline (status: Active).
- [x] **[App]** **Consume RGA in the app** — `buildGeneratedAnswer` controller + `GeneratedAnswerPanel` component with streaming answer, citations, like/dislike feedback.
- [x] **[Org]** **Preload a Query Suggest model** — `pokemon_QS` model created and associated to the default pipeline.
- [x] **[App]** **Consume QS in the app** — `numberOfSuggestions: 8` on `buildSearchBox` + WAI-ARIA combobox `SearchBoxWithSuggestions` (ArrowDown/Up navigation, Enter to apply, Escape to close).
- [x] **[App]** **Pokémon Detail Page** — `/pokemon/[slug]` route under `web/src/app/pokemon/[slug]/page.tsx`; client-side fetch via `fetch-pokemon-by-slug.ts` with `analytics: { enabled: false }` so detail loads don't pollute search analytics.
- [ ] **[Ship]** **Prepare a presentation** covering both topics from the brief:
  - Technical deep dive (what you built, Coveo configuration; format is your choice: demo, slides, docs, mix).
  - **Enterprise angle:** a past/present customer who could benefit from a similar Coveo solution + value proposition.

### Bonus

> *"BONUS" — Passage Retrieval API.*

- [ ] **[App] / [Ship]** Build something on the **Coveo Passage Retrieval API**, **or** document a **point of view** on future use cases.

### Brief documentation pointers (not scored)

> *Documentation & tips from the challenge PDF.*

- General docs: [docs.coveo.com](https://docs.coveo.com).

### Extras beyond the brief (Coveo platform optimizations)

- [x] **[Org]** **Featured Results** — Pikachu pin on `pokemon`, starter pins on `starter` (default pipeline → Result ranking).
- [x] **[Org]** **Automatic Relevance Tuning (ART)** — `pokemon_ART` model associated; training on `documentClick` events emitted by `buildInteractiveResult`.
- [x] **[Tooling]** **Optional Playwright ML seeder** — `tools/seed-ml/` runner that drives the live app to emit representative `search` / `searchQuerySuggest` / `facetSelect` / `genqa.citationClick` events. Separate npm package; not installed by `web/`.

---

## Local Development Setup

### Prerequisites
- Node.js 20.9.0+
- A Coveo Cloud Organization (invitation accepted)

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

**Optional — Coveo ML warm-up (Playwright):** Not part of the `web/` install. If you want to script analytics for Query Suggestions / RGA training, use the separate package under [`tools/seed-ml/`](./tools/seed-ml/) (see [docs/coveo-admin-playbook.md](./docs/coveo-admin-playbook.md) §3 Phase 4).

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

- Example deployment: [https://pokemon-db-coveo-local.vercel.app/](https://pokemon-db-coveo-local.vercel.app/) — update this README or your submission links if your team uses a different project name or custom domain.

For architecture context (Coveo vs app hosting), see [`docs/architecture.md`](./docs/architecture.md) §5.

### Production security (live site)

The `web/` app ships with **nonce-based Content-Security-Policy** (`src/middleware.ts`), **HTTP headers** and **`next/image` allowlists** in `next.config.ts`, and **`PokemonIndexedImage`** so only known HTTPS artwork hosts load in the UI. Details: [`docs/security-review.md`](./docs/security-review.md). **OWASP Top 10 deployment mapping** and `npm audit`: [`docs/owasp-deployment-review.md`](./docs/owasp-deployment-review.md).

---

## Key References

| Resource | URL |
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
| BST (Total) | `#dex-stats ~ div.resp-scroll tfoot td.cell-num:first-of-type` | `pokemonbst` (Integer 32) | **"Base stat total" facet** (5 labeled tiers) + emerald BST chip on each search-result card + **detail page** stats section total row (with tier label) |
| HP, Attack, Defense, Sp. Atk, Sp. Def, Speed | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(N) td.cell-num:first-of-type` | `pokemonhp`, `pokemonattack`, `pokemondefense`, `pokemonspatk`, `pokemonspdef`, `pokemonspeed` (Integer 32) | **Detail page** base-stats bar chart (value + proportional bar, scaled to 255) — not faceted or sorted in search results |
