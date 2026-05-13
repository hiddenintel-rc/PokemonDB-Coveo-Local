# Design decisions

This document records **why** the solution is shaped the way it is. It is intended for architects and reviewers of the challenge submission.

## DD-1: Coveo UI stack — Headless instead of Atomic

**Decision:** Use **`@coveo/headless`** with a custom React UI (Next.js), not **Coveo Atomic** (web components).

**Context:** The challenge allows either Atomic or Headless. Atomic accelerates a standard search page; Headless keeps all presentation in application code.

**Rationale:**

- Full control over layout, branding, and the Pokémon result card (image, type, generation).
- Aligns with a **Next.js** skill set and future features (e.g. detail routes, RGA, custom analytics wiring).
- Trade-off: more UI code to maintain than Atomic’s out-of-the-box components.

## DD-2: Next.js in a `web/` subdirectory

**Decision:** The application lives under **`web/`** rather than the repository root.

**Rationale:** Keeps a valid npm **`package.json` name** (`web`), isolates Node dependencies from the repo root, and matches common monorepo-style layouts. (If the repo root folder name ever contained spaces or invalid npm characters, placing the app under **`web/`** would still avoid those constraints.)

## DD-3: Client-only Coveo engine initialization

**Decision:** The search UI path calls **`getSearchEngine()`** only after **`coveoConfigured()`** passes (both **`NEXT_PUBLIC_COVEO_ORG_ID`** and **`NEXT_PUBLIC_COVEO_API_KEY`** non-empty). **`SearchInterface`** renders **`EnvMissingBanner`** instead of mounting **`SearchInterfaceConfigured`** when the guard fails. Public env vars are used so the browser can call Coveo directly.

**Rationale:**

- Avoid creating the engine during prerender when credentials are absent; empty org/token values interact badly with **`buildSearchEngine`** during **`next build`**.
- Challenge **local dev** expectation: Anonymous Search API key for **public** crawled content.

**Trade-off:** Credentials are exposed to anyone who can load the deployed JS bundle—acceptable only for **public** content and **Anonymous Search** keys; production patterns should use **search tokens** from a backend.

## DD-4: Singleton engine and controllers

**Decision:** One **SearchEngine** instance and one set of **controllers** (search box w/ QS, result list, three string facets, one numeric facet, generated answer) are created per browser session via module-level singletons in `search-instance.ts`. Per-result `buildInteractiveResult` controllers are the deliberate exception — one per card, memoized by `result` reference.

**Rationale:** Headless is designed around a single engine and stable controller instances. Multiple engines would duplicate state and analytics.

**Implication:** Not suitable for multi-tenant or per-request engines in the same tab without a refactor (e.g. React context + factory).

## DD-5: No `@coveo/headless-react` (SSR) in the initial scaffold

**Decision:** The first version does not use **`@coveo/headless-react`** for server-side rendering of search state.

**Rationale:** Simpler path to a working **“connect local app to cloud”** milestone. SSR search adds token handling, hydration, and deployment complexity.

**Future:** Add if SEO or first-paint search HTML becomes a requirement.

## DD-6: Indexing strategy (platform) — Web source and URL rules

**Decision (documented at platform level):** Use a **cloud Web** source (not Crawling Module) for public pokemondb.net, with **inclusion/exclusion** rules so the index favors **`/pokedex/{species}`** pages.

**Rationale:** Matches challenge wording (“only actual Pokémon pages”). Detailed URL patterns live in Admin Console and in `.cursor/rules/coveo-indexing.mdc`; they are not duplicated as executable code in the repo.

## DD-7: Field naming convention for indexed Pokémon attributes

**Decision:** Use lowercase, no-separator field names mirrored 1:1 in index, scrape config, mapping rules, `fieldsToInclude`, and `buildFacet`/`buildNumericFacet` field arguments. Current schema:

- **String:** `pokemontype` (multi-value), `pokemongeneration`, `pokemonability` (multi-value), `pictureuri`.
- **Integer 32:** `pokemonbst`, `pokemonhp`, `pokemonattack`, `pokemondefense`, `pokemonspatk`, `pokemonspdef`, `pokemonspeed`.

**Rationale:** Consistent mapping from HTML → index → Headless. Mismatch between the field name and the mapping rule (`%[fieldname]`) is the most common silent failure in Coveo scraping setups; one canonical lowercase name eliminates that surface area. Per-stat integer fields are kept in the index even though only `pokemonbst` is faceted today — they enable future `buildSort` / ranking expressions at zero ongoing cost.

## DD-8: `fieldsToInclude` on `buildResultList`

**Decision:** Pass an explicit **`fieldsToInclude`** array when building the **ResultList** controller (`web/src/coveo/search-instance.ts`), covering every custom field the UI reads from **`result.raw`** (plus **`syspictureuri`** as a mirror of **`pictureuri`** in many orgs, and `picture_uri`/`pokemon_generation` underscored fallbacks for alternate field-naming conventions).

**Context:** Headless documents that if **`fieldsToInclude`** is omitted, only **default** fields are returned on each hit. **Content Browser** still shows stored custom fields, which is easy to mistake for "search already returns them."

**Rationale:** Ensures `PokemonCard` receives image, facet-related values, and the BST integer in `raw` without relying on undocumented defaults.

## DD-9: Whole-card `<Link>` + per-result `buildInteractiveResult`

**Decision:** Each `PokemonCard` is wrapped in a Next.js `<Link href="/pokemon/[slug]">` with `onClick={() => interactiveResult.select()}`. The card body is presentational; the click target is the entire card. Per-result `buildInteractiveResult` controllers are memoized with `useMemo(..., [result])`.

**Rationale:** Two requirements collided neatly here:

1. **ART training signal** — without `interactiveResult.select()`, clicking a result card emits zero analytics. ART (Automatic Relevance Tuning) consumes `documentClick` events to re-rank future searches; without this wiring the model has nothing to learn from.
2. **Internal detail route** — the challenge brief's Advanced item asks for a Pokémon detail page; routing through a Next.js `<Link>` is the idiomatic way to navigate without a full reload.

A naive `<a href={result.clickUri} target="_blank">` on the title would have satisfied neither: no analytics event, no internal navigation.

**Trade-off:** A per-card controller per result means N controller instances per search response (~10–25 per page). Memoization keyed on `result` keeps the count stable across renders.

## DD-10: Client-side BST tier ranges (rejected: Indexing Pipeline Extension)

**Decision:** The five Base Stat Total tiers (`Frail` / `Average` / `Strong` / `Very strong` / `Legendary`) are defined in `BST_TIERS` in `web/src/coveo/search-instance.ts` and applied via `buildNumericFacet({ currentValues, generateAutomaticRanges: false })`. The raw `pokemonbst` integer stays in the index unchanged.

**Considered alternative:** Use an **Indexing Pipeline Extension** (Python script in Coveo Cloud, post-crawl) to compute a `pokemonbsttier` *string* field at index time.

**Rejected because:**

- Bucket boundaries are **presentation logic**, not data. Changing "Strong starts at 460 instead of 450" would otherwise require an IPE redeploy + full re-index.
- Keeping the raw integer keeps **sorting**, **ranking expressions** (`@pokemonbst>=600^25`), and **future per-stat facets** open without re-indexing.
- IPE is a separate Coveo construct (Python in-cloud) — operational surface area for no real win here.

**Trade-off:** The tier-to-label mapping has to happen in app code via `bstTierForRange(start, end)`. Adding a new tier requires editing both `BST_TIERS` and any code that hard-codes labels.

## DD-11: Separate `tools/seed-ml/` package (rejected: bundled with `web/`)

**Decision:** The Playwright ML warm-up script lives in `tools/seed-ml/` with its own `package.json` and `npm install`. It is **not** a workspace member of `web/`.

**Considered alternative:** Add `playwright` + `tsx` to `web/devDependencies` and an `npm run seed:ml` script.

**Rejected because:**

- Playwright ships a ~150 MB Chromium binary on install — punitive for contributors who only want to run the search app.
- The seeder is an operational tool, not part of the deliverable; coupling it to the deliverable's lockfile bloats every install.
- A separate package keeps the seeder reusable against any hosted instance of the app (`npm run seed -- --url https://...`).

**Trade-off:** Two `npm install`s when both the app and the seeder are needed. Documented in `coveo-admin-playbook.md` §3 Phase 4.

## DD-12: Detail-page fetch bypasses the Headless engine

**Decision:** `web/src/coveo/fetch-pokemon-by-slug.ts` issues a direct `POST /rest/search/v2` with `analytics: { enabled: false }` and a tight `aq=@uri==(...)` filter, instead of routing the detail-page lookup through the Headless engine.

**Rationale:**

- Detail-page navigation is not a "user search" — it shouldn't emit a `search` analytics event, increment the engine's search count, or mutate the home page's controller state (facets, query text, results).
- The `documentClick` event already fired on the home page when the user clicked the card; the detail fetch is a follow-up lookup, not a new search.
- Polluting the analytics corpus with detail-page `search` events would skew QS and ART training toward URI-filtered queries that aren't representative of actual user behavior.

**Trade-off:** A second code path that calls Coveo APIs directly (small — ~40 lines). Slug normalization (`normalizeSlug()` regex `^[a-z0-9-]+$`) is the security boundary that prevents `@uri==` injection from a malicious URL.

## DD-13: CSS3 selectors over jsoup pseudo-classes for web scraping

**Decision:** Web scraping selectors use only plain CSS3 — `:nth-of-type`, `:first-of-type`, attribute selectors, ID anchors, sibling combinators. The jsoup-specific pseudo-classes `:has(…)` and `:matchesOwn(regex)` are deliberately avoided.

**Context:** First-round BST selectors used `tr:has(> th:matchesOwn(^HP$)) > td.cell-num:first-of-type` (text-anchored, "robust against row reorders"). After rebuild, `pokemonhp` came back as `0` and the other six BST fields were absent entirely — a diagnostic asymmetry suggesting different selectors failed in different ways inside Coveo's scraping pipeline.

**Rejected:** jsoup pseudo-classes (despite being in the documented spec). The regex-escaping behavior of `\.` inside `:matchesOwn(^Sp\. Atk$)` interacts unpredictably with Coveo's selector parsing, and `:has` can degrade silently to a no-op match in some contexts.

**Adopted:** Position-anchored CSS3 — `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(1) td.cell-num:first-of-type::text`. Validated by the **sum identity**: `pokemonhp + pokemonattack + pokemondefense + pokemonspatk + pokemonspdef + pokemonspeed == pokemonbst` for any species (Golbat: 75 + 80 + 70 + 65 + 75 + 90 = 455). The sum is impossible to fake — it proves all seven selectors landed on the correct cells.

**Trade-off:** Position-anchored selectors break if pokemondb ever reorders the stats table. Pragmatically: the Pokémon community's HP/Atk/Def/SpA/SpD/Spe ordering has been canonical for 20+ years across every dex site on the internet; the brittleness is theoretical, not practical.

## DD-14: HTTP security headers — basic set now, CSP deferred to pre-deploy

**Decision:** Four universal security headers are set via `next.config.ts` `headers()` for all routes:

- `X-Frame-Options: DENY` — prevents clickjacking via iframe embedding.
- `X-Content-Type-Options: nosniff` — stops browsers MIME-sniffing response types.
- `Referrer-Policy: strict-origin-when-cross-origin` — sends full URL on same-origin requests, only the origin on cross-origin (prevents leaking search terms to Coveo's origin via the Referer header).
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — removes access to hardware APIs this app never uses.

**Deliberately deferred — Content Security Policy (CSP):** A correct CSP for this app must cover:
- `connect-src`: `platform.cloud.coveo.com` (Search API + analytics + RGA streaming).
- `font-src`: `fonts.gstatic.com` (Geist font via `next/font/google`).
- `style-src`: must include `'unsafe-inline'` or a per-request nonce because Tailwind generates `style="width:…%"` inline attributes (stat bars) and Next.js injects critical CSS inline.
- `img-src`: `img.pokemondb.net` plus Coveo's CDN domain (for `syspictureuri` fallback — domain to be confirmed in Content Browser).

A CSP with `'unsafe-inline'` for `style-src` weakens the primary XSS benefit. The correct path is either a nonce-based CSP (requires Next.js middleware) or waiting until the inline style is replaced with a CSS custom property. **Tracked as a pre-deploy checklist item** — do not ship to Vercel without it.

**Other deferred pre-deploy items (security audit, May 2026):**
- Switch `<img src={picture}>` to `next/image` with `remotePatterns: [{ hostname: 'img.pokemondb.net' }]` (add Coveo CDN hostname once confirmed). Enforces domain allowlist and enables image optimization.
- `npm audit` reports `postcss <8.5.10` (GHSA-qx2v-qp2m-jg93, moderate) inside `next/node_modules/postcss`. PostCSS runs only at build time and never processes user-controlled input in this app, so effective risk is negligible. **Do not run `npm audit fix --force`** — it would downgrade Next.js to 9.3.3. Watch for a Next.js patch that bumps its internal PostCSS and upgrade when available.
- `NEXT_PUBLIC_COVEO_API_KEY` in the client JS bundle is acceptable for an Anonymous Search key on public content (search-only, no admin access). For production, the correct mitigation is a server-side search token endpoint (DD-3). The key must never be an admin key or a key with write access.

## DD-15: Analytics mode pinned to `'legacy'` (rejected: Headless v3 default `'next'`)

**Decision:** `getSearchEngine()` passes **`analytics: { analyticsMode: 'legacy' }`** to `buildSearchEngine`, overriding the Headless v3 default of `'next'`.

**Context:** Headless v3 changed the default from `'legacy'` (Coveo UA via `analytics.js`) to `'next'` (Event Protocol via Relay). At every render, Headless logs a `[Warning] A component from the Coveo Headless library has been instantiated with the Analytics Mode: "Next". However, this mode is not available for Coveo for Service features…` — emitted by `buildSearchBox` / `buildResultList` / `buildGeneratedAnswer` whenever the engine isn't a Commerce-mode engine.

**Rationale:** Coveo's official v2→v3 upgrade guide (`docs.coveo.com/.../upgrade/v2-to-v3.html`) is explicit:

> *"Only Coveo for Commerce currently supports EP. For Service, Website, and Workplace implementations, EP is in closed beta. For all non-Commerce implementations upgrading to Headless v3, you should set `analyticsMode` to `'legacy'`."*

This project is a non-Commerce Search implementation on a trial org. Pinning `'legacy'`:

- Silences the per-render console warning — relevant during demo/review where a noisy console undermines a "production-ready" framing.
- Keeps every event flowing through the **Coveo UA endpoint (`/rest/ua/v15/analytics/...`)** that `pokemon_QS`, `pokemon_RGA`, and `pokemon_ART` were trained against. EP's event shape would split their training corpus into "before vs after" the switch with no observable upside on a non-Commerce org.
- Preserves access to `analyticsClientMiddleware` if request-time event redaction is ever needed (EP drops support for it).

**Considered alternative:** Stay on `'next'`. Rejected — it's actively flagged by Coveo as inappropriate for non-Commerce, the warning is non-suppressible from inside Headless, and the only theoretical benefit (server-side search-event logging) is part of EP's still-closed-beta surface for this implementation type.

**Trade-off:** EP is the long-term direction for Coveo analytics; when EP moves out of closed beta for Search / Service / Website / Workplace, revisit and migrate. Tracked in `docs/next-steps.md` §3.6.
