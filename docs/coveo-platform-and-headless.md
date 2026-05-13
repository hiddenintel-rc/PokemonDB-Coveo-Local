# Coveo platform inclusion and Headless toolset

This document answers two architect-level questions:

1. **Which Coveo components** (products, APIs, configuration objects) are part of this solution?
2. **What does the Coveo toolset provide** versus what the application must implement itself?

---

## 1. Coveo Cloud platform (Admin Console)

These are **not npm packages**; they are capabilities configured in **Coveo Administration Console** for the organization used in the challenge.

| Platform component | Role in this project |
|--------------------|----------------------|
| **Organization** (`roelc_Pokemon` trial) | Tenant boundary for sources, fields, API keys, query pipelines, ML models, and search traffic. |
| **Web source** (`PokemonDB Crawl`) | Cloud crawler that retrieves pokemondb.net `/pokedex/{slug}` pages per **starting URLs**, **inclusions**, and **exclusions**. |
| **Crawling rules** | Restrict which URLs become **items** in the index — single-segment `/pokedex/{slug}` species pages only; explicit exclusions for `/move/`, `/moves/`, `/type/`, `/ability/`, `/item/`, `/mechanic/`, `/pokebase/`, `/evolution/`. Detail: [`.cursor/rules/coveo-indexing.mdc`](../.cursor/rules/coveo-indexing.mdc). |
| **Web scraping configuration** | Eleven extraction rules (one per custom field) using jsoup-flavored CSS selectors with Coveo's `::text` / `::attr(...)` pseudo-elements. Anchored to stable DOM structures (`#dex-stats`, `main table.vitals-table:first-of-type`) — see [`coveo-admin-playbook.md`](./coveo-admin-playbook.md) §1 for the full selector set and the postmortem on `:has` / `:matchesOwn` failures. |
| **Fields (schema)** | **Custom fields** include: `pokemontype`, `pokemongeneration`, `pokemonability`, `pictureuri`, `pokemonnationalnumber` (String or Integer 32 — National №), and `pokemonbst`, `pokemonhp`, `pokemonattack`, `pokemondefense`, `pokemonspatk`, `pokemonspdef`, `pokemonspeed` (Integer 32). See [`coveo-indexing.mdc`](../.cursor/rules/coveo-indexing.mdc) for the schema table. |
| **Unified index** | Stores compressed/queryable **items** produced by the source. |
| **Query pipeline (`default`)** | Routes every search through: **Featured Result** rules (Pikachu pin on `pokemon`, starter pins on `starter`), then ML model evaluation. |
| **Result-ranking rules (Featured Result)** | Pinned curated species for specific queries. Configured in the default pipeline → Result ranking. |
| **Machine Learning — `pokemon_QS`** | **Query Suggestions** model, associated to default pipeline. App opts in via `buildSearchBox(..., { numberOfSuggestions: 8 })`. |
| **Machine Learning — `pokemon_RGA`** | **Relevance Generative Answering**, associated. App consumes via `buildGeneratedAnswer` controller; status: Active. |
| **Machine Learning — `pokemon_ART`** | **Automatic Relevance Tuning**, associated. App emits training signal via `buildInteractiveResult().select()` on result-card clicks; status: Build in progress (will move to Limited / Active as `documentClick` events accumulate). |
| **API keys** | **Anonymous Search** key used for browser-direct queries in development. Search hub may be enforced on the key (`AdminConsole`) — see `NEXT_PUBLIC_COVEO_SEARCH_HUB`. |
| **Usage Analytics** | Headless emits `search`, `searchQuerySuggest`, `facetSelect`, `documentClick`, `genqa.citationClick`, `like`, `dislike` events automatically. Feeds QS / ART / RGA training. |

**Out of scope today (deliberate):**

| Capability | Why not |
|---|---|
| **Coveo Atomic / Quantic** components | UI is custom React (see `design-decisions.md` DD-1). |
| **`@coveo/headless-react`** (SSR-oriented) | Client-only rendering is sufficient; revisit when hosted deployment + search tokens land. |
| **Passage Retrieval API** | Bonus challenge item — accepts either build OR POV writeup; not yet started (see `next-steps.md` §3.9). |
| **Smart Snippets** | Overlaps with RGA, which already handles the "single best answer" role. |
| **Dynamic Navigation Experience (DNE)** | Requires migrating to `buildFacetGenerator` — not worth the refactor with 4 hand-rolled facets (see `next-steps.md` §3.10). |
| **Search-token issuance** | Needs a backend route; out of scope for the local-dev scaffold. |

---

## 2. Application dependency: `@coveo/headless`

| Package | Version constraint (repo) | Purpose |
|---------|---------------------------|---------|
| **`@coveo/headless`** | `^3.50.1` | Client-side **state management** and **controllers** that speak to Coveo **Search**, **Analytics**, and **ML** endpoints. |

**Not included:**

| Package | Note |
|---------|------|
| **`@coveo/atomic`** | Deliberately omitted; UI is custom React. |
| **`@coveo/headless-react`** (SSR) | Not used in the current scaffold; search runs in the browser. |

**`@coveo/headless` vs `@coveo/headless-react`:** Headless alone is enough for a **client-rendered** React UI (this repo). **`@coveo/headless-react`** is aimed at **SSR-oriented** flows (server-run controllers, hydration patterns, stronger alignment with token-based auth). That is an **architectural choice**, not a requirement for React. Deploying the current app to **Vercel** (or similar) **does not** by itself force `headless-react`; you can ship the same client-only integration first. When we move to **live production**, we can revisit **search tokens**, optional **SSR** for SEO or first-paint HTML, and whether **`@coveo/headless-react`** earns its added complexity — deliberately **out of scope** until then.

---

## 3. Headless primitives used in code

The following are **JavaScript APIs** from `@coveo/headless` instantiated in **`web/src/coveo/search-instance.ts`** (singletons) and consumed by **`web/src/components/search/SearchInterface.tsx`** + **`PokemonCard`** + **`web/src/coveo/fetch-pokemon-by-slug.ts`**.

### 3.1 `buildSearchEngine`

**What it is:** The root runtime object: holds Redux-style **state**, orchestrates requests, and exposes **controllers**.

**What it provides:**

- Authentication context (**organization ID** + **access token**).
- **`searchHub`** tagging (`PokemonSearch`) for analytics + pipeline routing.
- Lifecycle methods like **`executeFirstSearch()`** for the initial query.

**What the app supplies:** Valid credentials, correct org ID, the `coveoConfigured()` guard that delays engine instantiation until env vars are present, and UI timing (when to call `executeFirstSearch`).

### 3.2 `buildSearchBox` (with Query Suggestions)

**What it provides:**

- Query text state (**`state.value`**).
- **`updateText`**, **`submit`**.
- When `numberOfSuggestions` > 0, **`state.suggestions`** populated by the associated QS model.
- **`showSuggestions()`**, **`selectSuggestion(rawValue)`** for combobox interactions.

**What the app implements:** WAI-ARIA combobox (`role="combobox"`, `role="listbox"`, ArrowDown/Up keyboard navigation, Enter to apply, Escape to close). See `SearchBoxWithSuggestions` in `SearchInterface.tsx`.

### 3.3 `buildResultList`

**What it provides:**

- **`state.results`**: ranked **`Result`** objects.
- **`state.isLoading`** and error facets.

**Options used:** **`fieldsToInclude`** — explicit list of custom indexed fields so they appear in each hit's **`raw`** object **in addition to** default fields. Without this, Coveo Headless sends queries that omit custom columns from hits even when they exist in the index (facet responses and Content Browser still show them — this is a common source of confusion).

**What the app implements:** Card layout, typography, image fallback chain (`pictureuri` → `picture_uri` → `syspictureuri`), BST chip, type / ability / generation lines.

### 3.4 `buildFacet` (×3 — string facets)

| Controller | Indexed field | `numberOfValues` | Multi-value | UI purpose |
|------------|---------------|-----------|---|------------|
| Type facet | `pokemontype` | 25 | Yes | Filter by Pokémon type(s) |
| Generation facet | `pokemongeneration` | 15 | No | Filter by generation |
| Ability facet | `pokemonability` | 50 | Yes | Filter by ability (large cardinality — `injectionDepth: 5000` raises facet scan depth) |

**Headless provides:** facet **values**, **counts**, **selection state**, **`toggleSelect(value)`**.

**App implements:** Checkbox list (`ProductFacetFilterSection` + `ProductFacetOptionRow` shared chrome), the inline empty-state hint when Coveo returns no values for a facet.

**Platform prerequisite:** Fields must exist in Admin → Content → Fields with **Facet = Yes** (and **Multi-value facet = Yes** for `pokemontype` / `pokemonability`).

### 3.5 `buildNumericFacet` (×1 — BST tier ranges)

```
buildNumericFacet(engine, {
  options: {
    field: 'pokemonbst',
    generateAutomaticRanges: false,
    currentValues: BST_TIERS.map(({ start, end }) => ({ start, end, endInclusive: false, state: 'idle' })),
  },
})
```

**Headless provides:** 5 range buckets with counts per tier, **`toggleSelect(NumericFacetValue)`**.

**App implements:** Tier label resolution (`bstTierForRange(start, end)` matching ranges back to `BST_TIERS` for human-readable labels like `Strong (450–519)`).

**Why fixed `currentValues` and not `generateAutomaticRanges: true`:** auto-generated bins produce ugly, meaningless ranges (`256–417`). Manual tier ranges + labels carry far more information per facet row. The tier boundaries live in app code (`BST_TIERS`) — adjusting them does **not** require a re-index because the raw `pokemonbst` integer stays in the index.

### 3.6 `buildGeneratedAnswer` (Coveo RGA)

**Headless provides:**

- **`state.answer`** (string, streamed): LLM-generated response.
- **`state.citations[]`**: list of source documents with `title`, `clickUri`, `uri`, `id`.
- **`state.isLoading`** / **`state.isStreaming`** / **`state.cannotAnswer`** / **`state.error`**.
- **`state.liked`** / **`state.disliked`** / **`state.feedbackSubmitted`** / **`state.answerId`**.
- Methods: **`logCitationClick(citationId, answerId?)`**, **`like()`**, **`dislike()`**, **`retry()`**.

**Options used:** `fieldsToIncludeInCitations: ['pictureuri', 'syspictureuri', 'pokemontype', 'pokemongeneration', 'pokemonability']` — so each citation's `result.raw` carries our custom fields if the UI ever renders citation thumbnails.

**App implements:** `GeneratedAnswerPanel` component above the result list. Handles five render states (thinking / streaming / answered / cannot-answer / errored / silent). Plain-text rendering (`whitespace-pre-wrap`) — no `dangerouslySetInnerHTML` per the security audit. Like/dislike buttons disable after `feedbackSubmitted`.

**Silent fallback:** when no RGA model is associated to the pipeline (or the org doesn't have RGA), `state.answer` stays undefined and `state.isLoading` stays false → the panel renders `null` and the page behaves exactly as it would without RGA.

### 3.7 `buildInteractiveResult` (one per result card)

```tsx
const interactiveResult = useMemo(
  () => buildInteractiveResult(getSearchEngine(), { options: { result } }),
  [result],
);
```

**Headless provides:** **`select()`** method that emits a `documentClick` analytics event tagged with the result's position, query, and metadata.

**App implements:** Calling `interactiveResult.select()` from the `<Link>`'s `onClick` so the event fires before Next.js navigates to the detail route. `useMemo` keyed on `result` avoids re-instantiating per render. The `<Link>` is the entire card.

**Why this matters:** `documentClick` is the **primary training signal Automatic Relevance Tuning (ART) consumes**. Without `buildInteractiveResult`, clicking a result card yielded zero analytics value and ART would have nothing to learn from.

### 3.8 `useCoveoController` (one generic React hook for all controllers)

Not a `@coveo/headless` API — a small bridge in `web/src/hooks/`:

```ts
type Subscribable<S> = { readonly state: S; subscribe(listener: () => void): () => void };

export function useCoveoController<S>(controller: Subscribable<S>): S {
  const [state, setState] = useState(controller.state);
  useEffect(() => controller.subscribe(() => setState(controller.state)), [controller]);
  return state;
}
```

Used for every controller above. The `[controller]` dep array is stable because controllers are module singletons.

### 3.9 Direct Search API call (`fetch-pokemon-by-slug.ts`)

The detail route bypasses the Headless engine and issues a raw `POST /rest/search/v2`:

```ts
{
  aq: `@uri==("${canonical}","${canonicalWithSlash}")`,
  numberOfResults: 1,
  fieldsToInclude: [...],
  analytics: { enabled: false },
}
```

**Rationale:** detail-page fetches are a different concern from "user search activity." They shouldn't:

- Increment the home page's search count.
- Emit a `search` analytics event that pollutes the QS / ART training corpus.
- Mutate the home page's engine state (facets, query, etc.).

The detail route is the only place this pattern exists; the home search continues to go through Headless.

---

## 4. External APIs Headless calls (conceptual)

Under normal operation the engine communicates with Coveo Cloud endpoints (exact URLs managed by the library):

| Concern | Coveo surface | Notes |
|---------|---------------|-------|
| Query execution | **Search API** (`/rest/search/v2`) | Standard search + RGA streaming. |
| Query suggestions | **Search API** (`/querySuggest`) | Triggered by `buildSearchBox` when `numberOfSuggestions > 0`. |
| Analytics events | **Analytics / Event APIs** | `search`, `searchQuerySuggest`, `facetSelect`, `documentClick`, `genqa.citationClick`, `like`, `dislike`. |
| Generative answer streaming | **`genqa`** streaming endpoint | Fired by `buildGeneratedAnswer` when an RGA model is associated. |

The Next.js app does **not** implement these protocols directly — Headless serializes requests and parses responses.

---

## 5. Responsibility split (architect view)

| Capability | Provided by Coveo | Provided by custom app |
|------------|-------------------|-------------------------|
| Crawling & indexing | Web source, scraping config, pipelines, index | — |
| Query parsing & retrieval | Search API + index | — |
| Facet aggregation (string + numeric) | Search API (facet requests driven by Headless) | Rendering facet UI + tier label mapping for numeric |
| Query Suggestions training & inference | `pokemon_QS` ML model | Rendering combobox dropdown + selectSuggestion plumbing |
| Generative answering | `pokemon_RGA` ML model + LLM | Rendering `GeneratedAnswerPanel` state machine + citations + feedback |
| Click-based re-ranking | `pokemon_ART` ML model | `buildInteractiveResult.select()` on every card click |
| Authentication for search | API key / token validation | Supplying key/token (today: env vars) |
| Search UI | — | Next.js + Tailwind + Headless controllers |
| Branding & accessibility | — | Application CSS/components (combobox ARIA, focus rings, dark mode) |
| Detail page data fetch | Search API (direct call) | `fetch-pokemon-by-slug.ts` (no Headless, no analytics) |
| Secure token issuance | Platform supports search tokens | **Not implemented** (future backend) |

---

## 6. Summary for stakeholders

- **Coveo** is responsible for **getting data in** (crawl + custom fields), **keeping it searchable**, and **executing intelligent search** (default pipeline + three associated ML models).
- **`@coveo/headless`** orchestrates everything client-side: queries, facets, results, suggestions, generative answers, and click analytics.
- **This repository's `web/` app** is responsible for **presentation**, **hosting**, and **developer ergonomics** (Next.js), while remaining intentionally thin on security until search tokens are introduced.

For file-level mapping from UI to code, see [application-components.md](./application-components.md). For system context, see [architecture.md](./architecture.md). For Admin Console step-by-step, see [coveo-admin-playbook.md](./coveo-admin-playbook.md).
