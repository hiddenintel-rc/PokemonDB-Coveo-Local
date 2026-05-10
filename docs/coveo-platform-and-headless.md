# Coveo platform inclusion and Headless toolset

This document answers two architect-level questions:

1. **Which Coveo components** (products, APIs, configuration objects) are part of this solution?
2. **What does the Coveo toolset provide** versus what the application must implement itself?

---

## 1. Coveo Cloud platform (Admin Console)

These are **not npm packages**; they are capabilities configured in **Coveo Administration Console** for the organization used in the challenge.

| Platform component | Role in this project |
|--------------------|----------------------|
| **Organization** | Tenant boundary for sources, fields, API keys, and search traffic. |
| **Web source** (`PokemonDB Crawl` or equivalent) | Cloud crawler retrieves pokemondb.net pages according to **starting URLs**, **inclusions**, and **exclusions**. |
| **Crawling rules** | Restrict which URLs become **items** in the index (e.g. Pokémon pages vs `/move/`, `/type/`, etc.). |
| **Web scraping configuration** | Extracts structured metadata into fields (e.g. type, generation, image URL), optionally trims noisy HTML. |
| **Fields** | Schema for indexed data; **`pokemontype`**, **`pokemongeneration`**, **`pictureuri`** must exist with appropriate facet/display settings for the UI to behave as designed. |
| **Unified index** | Stores compressed/queryable **items** produced by the source(s). |
| **Query pipeline** | Applies query-side processing (linguistics, ranking rules, filters). Used implicitly by every Headless search unless overridden in code. |
| **API keys** | **Anonymous Search**–style key used in **local development** to authorize **`Execute queries`** from the browser (must remain appropriate for **public** content only). |
| **Usage Analytics** (default behavior) | Headless sends usage events when analytics are enabled in configuration; supports future ML and reporting. |

**Out of scope in code (optional platform features):** Coveo **Atomic** components, **Quantic**, **RGA** (Relevance Generative Answering), **Query Suggest** models, **Passage Retrieval** API—these can be added later without replacing Headless.

---

## 2. Application dependency: `@coveo/headless`

| Package | Version constraint (repo) | Purpose |
|---------|---------------------------|---------|
| **`@coveo/headless`** | 3.50.x | Client-side **state management** and **controllers** that speak to Coveo **Search** and **Analytics** endpoints. |

**Not included:**

| Package | Note |
|---------|------|
| **`@coveo/atomic`** | Deliberately omitted; UI is custom React. |
| **`@coveo/headless-react` (SSR)** | Not used in the initial scaffold; search runs in the browser. |

**`@coveo/headless` vs `@coveo/headless-react`:** Headless alone is enough for a **client-rendered** React UI (this repo). **`@coveo/headless-react`** is aimed at **SSR-oriented** flows (server-run controllers, hydration patterns, stronger alignment with token-based auth). That is an **architectural choice**, not a requirement for React. Deploying the current app to **Vercel** (or similar) **does not** by itself force `headless-react`; you can ship the same client-only integration first. When we move to **live production**, we can revisit **search tokens**, optional **SSR** for SEO or first-paint HTML, and whether **`@coveo/headless-react`** earns its added complexity—deliberately **out of scope** until then.

---

## 3. Headless primitives used in code

The following are **JavaScript APIs** from `@coveo/headless` instantiated in **`web/src/coveo/search-instance.ts`** and consumed in **`SearchInterface.tsx`**.

### 3.1 `buildSearchEngine`

**What it is:** The root runtime object: holds Redux-style **state**, orchestrates requests, and exposes **controllers**.

**What it provides:**

- Authentication context for outbound calls (**organization ID** + **access token**).
- **`searchHub`** tagging (`PokemonSearch`) for analytics and pipeline routing.
- Lifecycle methods such as **`executeFirstSearch()`** for the initial query.

**What the app must supply:** Valid credentials, correct org ID, and UI timing (when to call **`executeFirstSearch`**).

### 3.2 `buildSearchBox`

**What it provides:**

- Query text state (**`value`**).
- **`updateText`**, **`submit`** (and hooks for suggestions if enabled later).

**What the app implements:** Input controls, submit button, validation UX.

### 3.3 `buildResultList`

**What it provides:**

- **`results`**: ranked **`Result`** objects for the current query context.
- Loading / error facets of state (e.g. **`isLoading`**).

**Options used in this repo:** **`fieldsToInclude`** lists custom indexed fields so they appear in each hit’s **`raw`** object **in addition to** default fields. Without this, Coveo Headless sends queries that omit custom columns from hits even when they exist in the index (facet responses and **Content Browser** can still show them).

**What the app implements:** Layout, typography, links, images—here via **`PokemonCard`** (**`pictureuri`** → **`picture_uri`** → **`syspictureuri`** in **`result.raw`**).

### 3.4 `buildFacet` (×2)

Facet controllers are built with **`numberOfValues`**: **25** on **`pokemontype`**, **15** on **`pokemongeneration`** (see `web/src/coveo/search-instance.ts`; raise these caps if your facets truncate values in Content Browser).

| Controller | Indexed field | UI purpose |
|------------|---------------|------------|
| Type facet | `pokemontype` | Filter by Pokémon type(s). |
| Generation facet | `pokemongeneration` | Filter by generation label/value. |

**What Headless provides:**

- Facet **values**, **counts**, and **selection state**.
- **`toggleSelect`** to apply facet filters to subsequent searches.

**What the app implements:** Checkbox list, labels, layout.

**Platform prerequisite:** Fields must exist, be populated by crawling/scraping, and be **facet-enabled** in the index; otherwise values will be empty or missing.

---

## 4. External APIs Headless calls (conceptual)

Under normal operation the engine communicates with Coveo Cloud endpoints (exact URLs managed by the library), conceptually:

| Concern | Typical Coveo surface |
|---------|------------------------|
| Query execution | **Search API** (`/rest/search/v2` region variants). |
| Usage analytics | **Analytics / Event** APIs (when enabled). |

The Next.js app does **not** implement these protocols directly—**Headless** serializes requests and parses responses.

---

## 5. Responsibility split (architect view)

| Capability | Provided by Coveo | Provided by custom app |
|------------|-------------------|-------------------------|
| Crawling & indexing | Web source, pipelines, index | — |
| Query parsing & retrieval | Search API + index | — |
| Facet aggregation | Search API (facet requests driven by Headless) | Rendering facet UI |
| Authentication for search | API key / token validation | Supplying key/token (today: env vars) |
| Search UI | — | Next.js + Tailwind + Headless controllers |
| Branding & accessibility | — | Application CSS/components |
| Secure token issuance | Platform supports search tokens | **Not implemented** (future backend) |

---

## 6. Summary for stakeholders

- **Coveo** is responsible for **getting data in** (crawl + fields), **keeping it searchable**, and **executing intelligent search** (pipeline + index).
- **`@coveo/headless`** is responsible for **client-side orchestration** of queries, facets, and results against those APIs.
- **This repository’s `web/` app** is responsible for **presentation**, **hosting**, and **developer ergonomics** (Next.js), while remaining intentionally thin on security until search tokens are introduced.

For file-level mapping from UI to code, see [application-components.md](./application-components.md). For system context, see [architecture.md](./architecture.md).
