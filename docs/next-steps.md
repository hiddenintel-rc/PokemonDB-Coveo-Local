# Next steps (planned work)

**Status:** Planned only — not implemented in `web/` or documented as complete in Coveo Admin.

This captures the agreed **Ability** and **BST** facet direction after ruling out Legendary/Mythical-style classifications as unreliable from pokemondb species pages.

---

## 1. Ability facet

### Why

Matches common player mental models (team building, “who has this ability?”). Data is **structured on pokemondb** in the main **Pokédex data** table (**Abilities** row), with links to `/ability/{slug}`.

### Coveo platform (Ability)

| Step | Action |
|------|--------|
| Field | Add e.g. **`pokemonability`** (name TBD but keep lowercase, consistent with `pokemontype`). **Multi-value string**, **Facet: yes** (same pattern as type). |
| Scraping | Extend Web scraping config on the Pokémon Web source: extract **ability names** from the **Abilities** row of the **first** vitals table (`main table.vitals-table` pattern — align with [`.cursor/rules/coveo-indexing.mdc`](../.cursor/rules/coveo-indexing.mdc)). Prefer links `td a[href^="/ability/"]` **scoped** to the Abilities row so mega/alternate blocks on the same URL do not poison values if possible; validate **multi-form** species (e.g. Mewtwo) in Content Browser. |
| Mappings | Ensure scraped metadata key matches the Coveo field (e.g. rule **`%[pokemonability]`**). |
| Rebuild | Full source rebuild/rescan after scraping changes. |

### Application (`web/`) — Ability

| Step | Action |
|------|--------|
| `search-instance.ts` | Add **`pokemonability`** to **`fieldsToInclude`**. Add **`buildFacet`** with a higher **`numberOfValues`** than type (many distinct abilities — start e.g. **50–100** and tune). |
| `SearchInterface.tsx` | Add **`ProductFacetFilterSection`** + **`PRODUCT_FILTER_IDS`** entry (e.g. `pokemon-ability`). Reuse **`ProductFacetOptionRow`**. |
| Optional card line | Show abilities on **`PokemonCard`** from **`facetValues(raw, 'pokemonability')`** for parity with types. |

---

## 2. BST (base stat total) facet

### Why

Single-number summary of stat budget; advanced dex sites often filter by total stats or bands.

### Source on pokemondb

**Base stats** table: row **`Total`**, first numeric cell = BST (e.g. Bulbasaur **318**).

### Representation

| Option | Notes |
|--------|--------|
| **A. Exact BST** | Store string or numeric **`pokemonbst`** (e.g. `318`). Facet works but many values; acceptable for demos if facet cap is raised. |
| **B. Buckets** (recommended UX) | Derive at scrape time into **`pokemonbsttier`** e.g. `Under 350`, `350–449`, `450–499`, `500–549`, `550+` (thresholds TBD). Fewer facet values, clearer for casual users. |

### Coveo platform (BST)

| Step | Action |
|------|--------|
| Field | **`pokemonbst`** and/or **`pokemonbsttier`** per chosen option. Facet on the facet-facing field. |
| Scraping | Selector targeting **first** `main` **Base stats** block **`Total`** row (same multi-form caveat as abilities). |
| Rebuild | After scraping/mapping updates. |

### Application (`web/`) — BST

| Step | Action |
|------|--------|
| `search-instance.ts` | Include new field(s) in **`fieldsToInclude`**; **`buildFacet`** on the facet field. |
| `SearchInterface.tsx` | New collapsible facet panel + **`data-product-filter`** id (e.g. `pokemon-bst` / `pokemon-bst-tier`). |
| Optional | Surface BST or tier on **`PokemonCard`** for quick scanning. |

---

## 3. Verification

After indexing:

1. **Content Browser** — spot-check Bulbasaur (dual ability + hidden), a single-ability species, and **one multi-form** species for consistent metadata.
2. **Search API** — confirm new fields appear in **`raw`** when listed in **`fieldsToInclude`** (same lesson as `pictureuri`).
3. **Facet counts** — confirm **`numberOfValues`** is high enough for Ability if not using search-within-facet.

---

## 4. Explicitly deferred

- **Legendary / Mythical / similar taxonomy** — not reliably exposed as a dedicated field on pokemondb species pages; no planned scrape-only facet unless requirements change.

---

## 5. Doc ownership

Keep implementation details that change frequently (exact selectors, field names after Admin rename) in **Admin Console** exports or comments beside scraping JSON if your team maintains them outside git.
