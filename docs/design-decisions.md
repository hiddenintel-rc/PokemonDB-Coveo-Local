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

**Decision:** One **SearchEngine** instance and one set of **controllers** (search box, result list, two facets) are created per browser session via module-level singletons in `search-instance.ts`.

**Rationale:** Headless is designed around a single engine and stable controller instances. Multiple engines would duplicate state and analytics.

**Implication:** Not suitable for multi-tenant or per-request engines in the same tab without a refactor (e.g. React context + factory).

## DD-5: No `@coveo/headless-react` (SSR) in the initial scaffold

**Decision:** The first version does not use **`@coveo/headless-react`** for server-side rendering of search state.

**Rationale:** Simpler path to a working **“connect local app to cloud”** milestone. SSR search adds token handling, hydration, and deployment complexity.

**Future:** Add if SEO or first-paint search HTML becomes a requirement.

## DD-6: Indexing strategy (platform) — Web source and URL rules

**Decision (documented at platform level):** Use a **cloud Web** source (not Crawling Module) for public pokemondb.net, with **inclusion/exclusion** rules so the index favors **`/pokedex/{species}`** pages.

**Rationale:** Matches challenge wording (“only actual Pokémon pages”). Detailed URL patterns live in Admin Console and in `.cursor/rules/coveo-indexing.mdc`; they are not duplicated as executable code in the repo.

## DD-7: Field naming for facets and templates

**Decision:** Use Coveo fields **`pokemontype`**, **`pokemongeneration`**, **`pictureuri`** as described in project rules, populated via **web scraping** where applicable.

**Rationale:** Consistent mapping from HTML to index to Headless **`buildFacet`** / **`result.raw`** access.

## DD-8: `fieldsToInclude` on `buildResultList`

**Decision:** Pass an explicit **`fieldsToInclude`** array when building the **ResultList** controller (`web/src/coveo/search-instance.ts`), covering every custom field the UI reads from **`result.raw`** (plus **`syspictureuri`** as a mirror of **`pictureuri`** in many orgs).

**Context:** Headless documents that if **`fieldsToInclude`** is omitted, only **default** fields are returned on each hit. **Content Browser** still shows stored custom fields, which is easy to mistake for “search already returns them.”

**Rationale:** Ensures **`PokemonCard`** receives image and facet-related values in **`raw`** without relying on undocumented defaults.
