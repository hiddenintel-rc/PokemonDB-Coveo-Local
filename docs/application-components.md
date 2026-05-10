# Application components (Next.js)

This describes the **deliverable codebase** under **`web/`**: routing, React composition, and Headless wiring—not Coveo Admin configuration.

## Technology summary

| Piece | Version / notes |
|-------|------------------|
| Framework | Next.js 16.2.x (App Router); see `web/package.json` |
| UI library | React 19.2.x |
| Styling | Tailwind CSS 4.x |
| Search SDK | `@coveo/headless` ^3.50.1 |

## Directory map

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, fonts, metadata
│   │   ├── page.tsx            # Home route — renders SearchInterface shell
│   │   └── globals.css         # Global styles / Tailwind entry
│   ├── coveo/
│   │   └── search-instance.ts  # Headless engine + controller singletons
│   ├── components/
│   │   └── search/
│   │       └── SearchInterface.tsx   # Search UI, facets, results, env gate
│   └── hooks/
│       └── useCoveoController.ts    # Generic subscribe → React state bridge
├── .env / .env.local           # Local credentials (gitignored); copy from `.env.example`
├── .env.example                # Documented keys only — safe to commit
└── package.json
```

## Route and page layer

| Module | Role |
|--------|------|
| **`src/app/page.tsx`** | Server-compatible entry for `/`. Wraps content in page chrome and renders **`SearchInterface`**. |
| **`src/app/layout.tsx`** | Sets document metadata (`title`, `description`), fonts, and body layout. |

## Client module: `SearchInterface.tsx`

Marked **`"use client"`**. Two-tier structure:

| Export / symbol | Purpose |
|-----------------|--------|
| **`SearchInterface`** | If **`coveoConfigured()`** is false (missing org ID or API key), renders **`EnvMissingBanner`** (copy **`.env.example`** to **`.env.local`** per on-screen copy; **`.env`** works too). Otherwise renders **`SearchInterfaceConfigured`**. |
| **`SearchInterfaceConfigured`** | Obtains controllers, subscribes via hooks, runs **`executeFirstSearch()`** once on mount, renders search form, facet columns, and result list. |
| **`PokemonCard`** | Presentational row/card for one **`Result`**: title link (`clickUri`); image URL from **`pictureuri`**, then **`picture_uri`**, then **`syspictureuri`** in **`result.raw`**; types from **`pokemontype`** via **`facetValues`** (string or array); generation from **`pokemongeneration`** or **`pokemon_generation`**. |
| **`PRODUCT_FILTER_IDS`** | Stable **`data-product-filter`** ids (**`pokemon-type`**, **`pokemon-generation`**) for CSS targeting; exported next to the filter UI. |
| **`ProductFacetFilterSection`** | One collapsible facet panel (**`<details>`**, closed by default): shared chrome + **`data-product-filter`**. |
| **`ProductFacetOptionRow`** | Uniform checkbox row: **`data-filter-option`**, BEM-style **`product-filter__*`** classes. |

Facet sidebar wrapper: **`data-region="product-filters"`** (`aria-label="Product filters"`). Styling hook reference comment lives in **`globals.css`**.

## Coveo integration module: `search-instance.ts`

| Export | Responsibility |
|--------|------------------|
| **`getSearchEngine()`** | Lazily builds **`buildSearchEngine`** with org ID, access token, and **`searchHub`** from **`NEXT_PUBLIC_COVEO_SEARCH_HUB`** (default **`PokemonSearch`**). |
| **`getSearchControllers()`** | Builds **`buildSearchBox`**, **`buildResultList`** (with **`fieldsToInclude`** for custom columns—see below), and **`buildFacet`** on **`pokemontype`** (25 values) and **`pokemongeneration`** (15 values). |
| **`coveoConfigured()`** | `true` only when **`NEXT_PUBLIC_COVEO_ORG_ID`** and **`NEXT_PUBLIC_COVEO_API_KEY`** are both non-empty truesy strings. |

### `buildResultList` — `fieldsToInclude`

Headless only adds **extra** indexed fields to each hit when they are listed here; otherwise **`result.raw`** contains **default** fields only. That differs from **Content Browser**, which lists every stored field on an item—custom fields such as **`pictureuri`** can be populated in the index but **absent from search hits** until included.

Configured names: **`pictureuri`**, **`syspictureuri`**, **`pokemontype`**, **`pokemongeneration`**, **`picture_uri`**, **`pokemon_generation`** (the last two cover alternate Coveo field naming).

## Hook: `useCoveoController.ts`

Generic helper for any Headless controller exposing **`state`** and **`subscribe`**. Subscribes in **`useEffect`** and unsubscribes on teardown. The dependency array is **`[controller]`**; this is stable because controllers are module singletons from **`search-instance.ts`**.

## UI ↔ Headless mapping

| UI region | Headless controller | User-visible behavior |
|-----------|---------------------|------------------------|
| Search input + button | **SearchBox** | **`updateText`**, **`submit`** |
| Type facet list | **Facet** (`pokemontype`) | **`toggleSelect`** per facet value |
| Generation facet list | **Facet** (`pokemongeneration`) | Same |
| Results area | **ResultList** (`fieldsToInclude` set in **`search-instance.ts`**) | Reads **`results`**, **`isLoading`**; each **`Result.raw`** includes the listed custom fields |

## Configuration surface

Values are read from **`.env`** / **`.env.local`** locally (both gitignored in `web/.gitignore`) and from the **host env** in production. **`.env.example`** lists names only.

| Variable | Consumed by |
|----------|-------------|
| `NEXT_PUBLIC_COVEO_ORG_ID` | Engine configuration |
| `NEXT_PUBLIC_COVEO_API_KEY` | Engine configuration (Anonymous Search template key in dev) |
| `NEXT_PUBLIC_COVEO_SEARCH_HUB` | Optional; defaults to `PokemonSearch`. Must match the **Search hub** enforced on the Anonymous Search API key **when** the key locks a hub (e.g. `AdminConsole`). |

## Not yet implemented (natural extensions)

- Pagination (**`Pager`** or equivalent controller pattern).
- Sort criteria (**`Sort`**).
- Query suggestions (**`SearchBox` suggestion APIs** or dedicated suggestion controller).
- Dedicated Pokémon **detail route** (`/pokemon/[slug]`) fed by the same index (Advanced challenge item).
- **Ability** and **BST** facets — planned indexing + UI steps: **[next-steps.md](./next-steps.md)**.
