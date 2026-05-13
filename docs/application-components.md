# Application components (Next.js)

This describes the **deliverable codebase** under **`web/`**: routing, React composition, and Headless wiring—not Coveo Admin configuration.

## Technology summary

| Piece | Version / notes |
|-------|------------------|
| Framework | Next.js 16.2.x (App Router); see `web/package.json` |
| UI library | React 19.2.x |
| Styling | Tailwind CSS 4.x |
| Search SDK | `@coveo/headless` ^3.50.1 |

## Pokémon facts vs presentation

All **Pokémon facts** shown on `/` and `/pokemon/[slug]` come from **Coveo**: Headless search hits (`result.title`, `result.clickUri`, `result.raw`) on the home page, and **`POST /rest/search/v2`** (`fetchPokemonBySlug`) on the detail page. There is **no** local Pokédex JSON, no REST call to pokemondb for copy or stats, and no server-side scrape in this app.

**Intentional non-index sources:** (1) **Image bytes** — the `src` URL is from Coveo (`pictureuri` / fallbacks); the browser loads pixels via **`next/image`** from allowlisted hosts. (2) **Presentation-only** — `cleanIndexedPokemonTitle` trims noise from the indexed **title** string; `formatNationalDex` / type pill colors format Coveo values; bar charts use a fixed **255** scale cap; **`BST_TIERS`** maps the indexed **`pokemonbst`** integer to facet ranges and tier **labels** (Frail / … / Legendary) without replacing the number. (3) **RGA** — generative answer text is produced by Coveo’s model from indexed content, not from a second fact database in the repo.

## Directory map

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout — async; passes CSP `nonce` from middleware to `<html>`
│   │   ├── page.tsx            # Home route — renders SearchInterface shell
│   │   ├── pokemon/
│   │   │   └── [slug]/
│   │   │       └── page.tsx    # Dynamic detail route — renders PokemonDetailView (key={slug})
│   │   └── globals.css         # Global styles / Tailwind entry
│   ├── middleware.ts           # Per-request CSP + `x-nonce` for Next.js script/style nonces
│   ├── coveo/
│   │   ├── search-instance.ts          # Headless engine + controller singletons
│   │   └── fetch-pokemon-by-slug.ts    # One-off Coveo Search API fetch (no analytics)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx            # Centered max-width page wrapper
│   │   │   ├── Card.tsx                # Card + CardSection primitives
│   │   │   └── SidePanel.tsx           # Collapsible panel (detail route uses stacked Stats card instead)
│   │   ├── search/
│   │   │   └── SearchInterface.tsx     # Search UI, facets, results, env gate
│   │   └── pokemon/
│   │       ├── PokemonDetailView.tsx   # Detail page: skeleton/found/not-found/error states
│   │       ├── PokemonIndexedImage.tsx # `next/image` wrapper — HTTPS allowlist (pokemondb + Coveo CDN)
│   │       └── PokemonTypePill.tsx     # Type-colored pills (search + detail)
│   ├── lib/
│   │   └── nationalDex.ts              # National № parsing/formatting from `result.raw` (no extra fetch)
│   └── hooks/
│       └── useCoveoController.ts       # Generic subscribe → React state bridge
├── .env / .env.local           # Local credentials (gitignored); copy from `.env.example`
├── .env.example                # Documented keys only — safe to commit
└── package.json
```

## Route and page layer

| Module | Role |
|--------|------|
| **`src/app/page.tsx`** | Server-compatible entry for `/`. Wraps **`SearchInterface`** in **`min-h-dvh bg-pokedex-catalog text-zinc-950`**. |
| **`src/app/layout.tsx`** | Sets document metadata (`title`, `description`), fonts, and body layout. |
| **`src/app/pokemon/[slug]/page.tsx`** | Dynamic route for one Pokémon. Client Component; unwraps the Promise-shaped `params` with React **`use()`** (Next.js 16 convention) and renders **`<PokemonDetailView key={slug} slug={slug} />`** so navigating between detail pages remounts the view (fresh skeleton, no in-effect setState). Wrapper uses **`min-h-dvh bg-pokedex-catalog text-zinc-950`** to match the home catalog canvas. |

## Client module: `SearchInterface.tsx`

Marked **`"use client"`**. Two-tier structure:

| Export / symbol | Purpose |
|-----------------|--------|
| **`SearchInterface`** | If **`coveoConfigured()`** is false (missing org ID or API key), renders **`EnvMissingBanner`** (copy **`.env.example`** to **`.env.local`** per on-screen copy; **`.env`** works too). Otherwise renders **`SearchInterfaceConfigured`**. |
| **`SearchInterfaceConfigured`** | Obtains controllers, subscribes via hooks, runs **`executeFirstSearch()`** once on mount, renders search form, facet columns, and result list. |
| **`PokemonCard`** | Presentational row/card for one **`Result`**, wrapped in a Next.js **`<Link href={'/pokemon/' + slug}>`** so the whole card navigates to the internal detail route. Slug derived from **`clickUri`** via **`slugFromClickUri`**. A per-result **`buildInteractiveResult`** controller emits a `documentClick` analytics event on click (`select()`) — feeds Automatic Relevance Tuning (ART). Image URL falls through **`pictureuri`** → **`picture_uri`** → **`syspictureuri`** in **`result.raw`** and is rendered with **`PokemonIndexedImage`**. Types from **`pokemontype`**; national № from **`pokemonnationalnumber`** (and aliases in `nationalDexFromRaw`) when indexed; display name from **`cleanIndexedPokemonTitle(result.title)`**; BST from **`pokemonbst`** via **`bstFromRaw`**, shown as **`BST {n}`** with sky accent next to the formatted dex line when present. |
| **`PRODUCT_FILTER_IDS`** | Stable **`data-product-filter`** ids (**`pokemon-type`**, **`pokemon-generation`**, **`pokemon-ability`**, **`pokemon-bst`**) for CSS targeting; exported next to the filter UI. |
| **`ProductFacetFilterSection`** | One facet as a **button + floating panel** (popover): click opens that filter’s checkbox list without shifting the result grid; click-outside and Escape close. Shared chrome + **`data-product-filter`**. |
| **`ProductFacetOptionRow`** | Uniform checkbox row: **`data-filter-option`**, BEM-style **`product-filter__*`** classes. |

Facet sidebar wrapper: **`data-region="product-filters"`** (`aria-label="Product filters"`). Styling hook reference comment lives in **`globals.css`**.

## Edge middleware: `middleware.ts`

Runs on **document** requests (matcher skips `/_next/static`, `/_next/image`, `favicon.ico`, and common static file extensions). Sets **`Content-Security-Policy`** with a per-request **nonce** (`script-src` / `style-src`), allowlists **`connect-src`** for Coveo **Search + legacy UA analytics + WebSockets** (`https://*.cloud.coveo.com`, `wss://*.cloud.coveo.com`, explicit `platform*` / `analytics*` / `analytics-au` / `static.cloud.coveo.com`) so **ART**, **QS**, **RGA**, and facet/click signals reach Coveo ML, and **`img-src`** to self, `blob:`/`data:` (for `next/image`), pokemondb, and **`*.cloud.coveo.com`**. Injects **`x-nonce`** on the request so **`app/layout.tsx`** can forward it to **`<html nonce={…}>`** for Next.js–compatible CSP (see Next.js CSP docs).

## Client module: `PokemonIndexedImage.tsx`

| Symbol | Purpose |
|--------|---------|
| **`PokemonIndexedImage`** | **`"use client"`**. Wraps **`next/image`** with **`fill`** for known HTTPS hosts only (`img.pokemondb.net`, `www.pokemondb.net`, any **`*.cloud.coveo.com`**). Unknown URLs render the same **No image** placeholder so arbitrary `src` strings cannot widen the CSP surface. Used by **`PokemonCard`** and **`PokemonDetail`**. |

## Client module: `PokemonDetailView.tsx`

Marked **`"use client"`**. Four render states driven by a `ViewState` discriminated union (`loading` / `found` / `notfound` / `error`). Fetches on mount via `fetchPokemonBySlug`; cleanup cancels the request on unmount.

| Symbol | Purpose |
|--------|---------|
| **`PokedexDetailChrome`** | Wraps loading / found / not-found / error states: **`AppShell`** with **`max-w-[42rem] lg:max-w-6xl bg-white/95`** (aligned with search), **Back to search** (sky), **Coveo Pokédex** eyebrow, optional **# + BST** meta line, and **`h1`** title. |
| **`PokemonDetailView`** | Exported. Dispatches to skeleton / found / not-found / error sub-renders. `key={slug}` on the parent call-site remounts on slug navigation (fresh `loading` state, no cascading `setState`). |
| **`PokemonDetail`** | **`PokedexDetailChrome`**, then a **stacked** layout: primary **white** **`Card`** (sprite, types, generation, abilities, footer) and a secondary **Stats** **`Card`** (`bg-zinc-50`, `region="pokemon-stats"`) with **`BaseStatsPanel`** — mirrors pokemondb’s separate stats block instead of a narrow side column. |
| **`BaseStatsPanel`** | Reads **`pokemonhp`** … **`pokemonspeed`** and **`pokemonbst`** from the Coveo hit’s **`raw`**. Renders six **SVG** bar rows (CSP-friendly), scaled to **255** as a visualization cap, plus **Total** with BST and optional tier label from **`BST_TIERS`**. Renders `null` if no stat data is in `raw`. |
| **`PokemonDetailSkeleton`** | Animated pulse placeholder shown while the fetch is in-flight. |
| **`PokemonNotFound`** | Displayed when Coveo returns no hits for the slug. |
| **`PokemonDetailError`** | Displayed on fetch errors (network, bad status, credential issues). |

## Coveo integration module: `search-instance.ts`

| Export | Responsibility |
|--------|------------------|
| **`getSearchEngine()`** | Lazily builds **`buildSearchEngine`** with org ID, access token, and **`searchHub`** from **`NEXT_PUBLIC_COVEO_SEARCH_HUB`** (default **`PokemonSearch`**). |
| **`getSearchControllers()`** | Builds **`buildSearchBox`** (with **`numberOfSuggestions: 8`** for Coveo Query Suggestions), **`buildResultList`** (with **`fieldsToInclude`** for custom columns—see below), **`buildFacet`** on **`pokemontype`** (25 values), **`pokemongeneration`** (15 values), and **`pokemonability`** (50 values), **`buildNumericFacet`** on **`pokemonbst`** (5 labeled tiers, `generateAutomaticRanges: false`, `currentValues` driven by exported **`BST_TIERS`**), and **`buildGeneratedAnswer`** (with **`fieldsToIncludeInCitations`** mirroring our custom fields) for Coveo RGA. |
| **`BST_TIERS`** / **`bstTierForRange()`** | Exported. `BST_TIERS` is the single source of truth for the BST facet ranges and labels (5 community tiers: Frail / Average / Strong / Very strong / Legendary). `bstTierForRange(start, end)` resolves a `NumericFacetValue` back to its tier so `SearchInterface.tsx` can render the labeled facet row. `BST_TIERS` is also imported by `PokemonDetailView.tsx` to resolve a raw BST integer to its tier label (`.find()` with range semantics). Bucketing is presentation logic — adjust this array, no re-index required. |
| **`coveoConfigured()`** | `true` only when **`NEXT_PUBLIC_COVEO_ORG_ID`** and **`NEXT_PUBLIC_COVEO_API_KEY`** are both non-empty truesy strings. |

## Coveo lookup module: `fetch-pokemon-by-slug.ts`

| Export | Responsibility |
|--------|------------------|
| **`slugFromClickUri(clickUri)`** | Pulls the last non-empty path segment from a result's **`clickUri`** (e.g. `https://pokemondb.net/pokedex/charizard` → `charizard`), lowercased. Returns `null` for unparseable URLs. |
| **`normalizeSlug(slug)`** | Validates a user-provided URL slug against `^[a-z0-9-]+$` (after `decodeURIComponent` + trim + lowercase). Returns `null` on rejection — used as the "is this a sane slug?" guard before hitting Coveo. |
| **`fetchPokemonBySlug(slug, signal?)`** | Issues a direct **`POST /rest/search/v2`** with **`aq=@uri==(...)`** over **`https://pokemondb.net/...`** and **`https://www.pokemondb.net/...`** (with and without trailing slash) + **`numberOfResults: 1`** + **`fieldsToInclude`** covering every field the detail UI reads: `pictureuri`, `syspictureuri`, `pokemontype`, `pokemongeneration`, `pokemonability`, **`pokemonnationalnumber`**, **`pokemonbst`**, the six per-stat keys, plus **`picture_uri`** / **`pokemon_generation`** fallbacks — and **`analytics: { enabled: false }`**. Returns the first hit or `null`. |

Used only by the detail route — the home/search UI continues to go through the Headless engine singletons.

### `buildResultList` — `fieldsToInclude`

Headless only adds **extra** indexed fields to each hit when they are listed here; otherwise **`result.raw`** contains **default** fields only. That differs from **Content Browser**, which lists every stored field on an item—custom fields such as **`pictureuri`** can be populated in the index but **absent from search hits** until included.

Configured names (search results): **`pictureuri`**, **`syspictureuri`**, **`pokemontype`**, **`pokemongeneration`**, **`pokemonability`**, **`pokemonbst`**, **`pokemonnationalnumber`**, **`picture_uri`**, **`pokemon_generation`**. The six per-stat fields (`pokemonhp`, …) are **not** listed here because cards only show BST + types + image + national №; the detail fetch requests those stat fields separately via **`DETAIL_FIELDS_TO_INCLUDE`**.

## Hook: `useCoveoController.ts`

Generic helper for any Headless controller exposing **`state`** and **`subscribe`**. Subscribes in **`useEffect`** and unsubscribes on teardown. The dependency array is **`[controller]`**; this is stable because controllers are module singletons from **`search-instance.ts`**.

## UI ↔ Headless mapping

| UI region | Headless controller | User-visible behavior |
|-----------|---------------------|------------------------|
| Search input + suggestions dropdown + button | **SearchBox** (with QS) | **`updateText`**, **`submit`**, **`showSuggestions`**, **`selectSuggestion`** (state: `value`, `suggestions`, `isLoadingSuggestions`) — combobox pattern in **`SearchBoxWithSuggestions`** |
| Type facet list | **Facet** (`pokemontype`) | **`toggleSelect`** per facet value |
| Generation facet list | **Facet** (`pokemongeneration`) | Same |
| Ability facet list | **Facet** (`pokemonability`) | Same |
| Base stat total facet (5 labeled tiers) | **NumericFacet** (`pokemonbst`) | **`toggleSelect`** per `NumericFacetValue`; label resolution via **`bstTierForRange`** from `BST_TIERS`. Renders inline hint when all counts are 0 (field missing from index). |
| AI answer panel above results | **GeneratedAnswer** (RGA) | Renders streaming `answer`, numbered `citations[]`, like/dislike feedback. Silent when no model/answer. Component: **`GeneratedAnswerPanel`**. |
| Results area | **ResultList** (`fieldsToInclude` set in **`search-instance.ts`**) | Reads **`results`**, **`isLoading`**; each **`Result.raw`** includes the listed custom fields |
| Whole-card click → detail route | **InteractiveResult** (`buildInteractiveResult` per card) | **`select()`** emits `documentClick` analytics on navigation — the training signal Automatic Relevance Tuning (ART) needs |
| Detail page — stats block | _(no Headless — same Coveo hit as main card)_ | **`BaseStatsPanel`** inside a light **Stats** card below the species card; horizontal bars use explicit **`fill-sky-*`** (no `fill-current`). |

## Configuration surface

Values are read from **`.env`** / **`.env.local`** locally (both gitignored in `web/.gitignore`) and from the **host env** in production. **`.env.example`** lists names only.

| Variable | Consumed by |
|----------|-------------|
| `NEXT_PUBLIC_COVEO_ORG_ID` | Engine configuration |
| `NEXT_PUBLIC_COVEO_API_KEY` | Engine configuration (Anonymous Search template key in dev) |
| `NEXT_PUBLIC_COVEO_SEARCH_HUB` | Optional; defaults to `PokemonSearch`. Must match the **Search hub** enforced on the Anonymous Search API key **when** the key locks a hub (e.g. `AdminConsole`). |

## Not yet implemented (natural extensions)

- Pagination (**`Pager`** or equivalent controller pattern).
- Sort criteria (**`Sort`**) — `pokemonbst` plus the six per-stat fields (HP/Attack/Defense/Sp. Atk/Sp. Def/Speed) are all `Sortable: Yes` in the index once Admin setup completes, so "Sort by Speed (desc)" is a small `buildSort` away.
- Search-within-facet and other platform optimizations — see **[next-steps.md](./next-steps.md)** §3.
- Related Pokémon strip on the detail page (second Coveo query, filter by type/generation) — deferred from the detail-page round.
