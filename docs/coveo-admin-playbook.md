# Coveo Admin Console playbook

Operational procedures performed in the **Coveo Administration Console** (everything outside the `web/` codebase). Use this as a reproducible step-by-step reference; descriptive context lives in [coveo-platform-and-headless.md](./coveo-platform-and-headless.md), code-side mapping in [application-components.md](./application-components.md).

**Console URL:** https://platform.cloud.coveo.com/admin/

---

## 1. Add a new facet end-to-end

Adding a faceted field has **four Admin phases** plus **one app phase**:

1. Define the field in the index schema (Content > Fields).
2. Extract the value from each crawled page (Sources > Web Scraping).
3. Map the scraped metadata onto the field (Sources > Mappings).
4. Rebuild the source and verify in Content Browser.
5. Wire the field into the search UI (`web/`).

The **Ability** facet (`pokemonability`) is used as the worked example throughout; substitute names and selectors for any new facet.

---

### Phase 1 — Create the custom field

**Path:** Content > Fields > **Add Field**

| Setting | Value for `pokemonability` | Notes |
|---|---|---|
| Field Name | `pokemonability` | Lowercase, no spaces. **The same name is used in five places**: this field, the scraped metadata key, the mapping rule, `fieldsToInclude` in `search-instance.ts`, and `buildFacet({ field: … })`. Keep aligned with sibling fields (`pokemontype`, `pokemongeneration`). |
| Type | String | Must match the data shape. Use Integer for numeric (`pokemonbst`), String for text. |
| Description | "Pokémon ability names extracted from pokemondb species pages" | Free text; helps future maintainers understand intent. |
| Facet | **Yes** | Required for the field to appear as a filter at all. |
| Multi-value Facet | **Yes** for `pokemonability` (multiple abilities per species) | Required only when one item can hold multiple values (`pokemontype`, `pokemonability`). Leave **off** for single-value fields like `pokemongeneration`. |
| Sortable | No | Only enable for fields you intend to sort results by. |
| Assign to project | Per your org's project setup | Allows the field to show in project-scoped admin views. |

**Common silent failures**

- **Multi-value Facet left off** on a multi-valued field → only the first value gets indexed for facet aggregation, and `result.raw[field]` is a string instead of an array. Both fail without an error.
- **Field name typo** (e.g. `pokemonAbility` vs `pokemonability`) → mapping appears to succeed but the facet is always empty because the index name and the mapping target don't match.

---

### Phase 2 — Extract the value via Web Scraping

**Path:** Sources > _{your Web source}_ > Edit > **Web Scraping** > _Default_ (or **Add Configuration**) > **Metadata to extract**

| Setting | Value for `pokemonability` |
|---|---|
| Metadata name | `pokemonability` (must equal the field name from Phase 1) |
| Selector type | CSS (XPath available — choose per [selector-design notes](./coveo-platform-and-headless.md#selector-stability) / current discussion in commit history) |
| Selector value | `main table.vitals-table:first-of-type td a[href^="/ability/"]::text` |

**Default vs Add Configuration**

- **Default** is fine while one selector set covers every URL the source crawls (current state for this project — every Pokémon page uses the same template).
- **Add Configuration** + URL filter when different page templates need different selectors (e.g. if a future Moves source shares the same crawl with a different DOM).

**Selector design principles** (full discussion in [coveo-platform-and-headless.md](./coveo-platform-and-headless.md))

- Prefer **page-level meta tags** (`meta[property="og:image"]`) when the data exists there — most stable.
- Prefer **attribute filters** (`a[href^="/ability/"]`) over **DOM position** (`tr:nth-child(6)`) — survives row reorders and minor template edits.
- **Scope to the relevant region** (e.g. `table.vitals-table:first-of-type`) so multi-form species pages don't poison values.

---

### Phase 3 — Map the scraped metadata to the field

**Path:** Sources > _{your Web source}_ > **Mappings** > **Add** > **Mapping**

| Setting | Value for `pokemonability` |
|---|---|
| Field | `pokemonability` (selected from the field dropdown — the field must already exist from Phase 1) |
| Rules | `%[pokemonability]` |

The `%[…]` rule pulls the value of the metadata key extracted in Phase 2. The metadata key, the field name, and the rule reference **all share one name** across these three steps — keep them in sync; mismatch is the most common cause of an empty facet after a clean rebuild.

**Optional patterns**

- Fallback chain: `%[pokemonability]; %[ability]` tries a secondary key if the primary is empty. Use sparingly — it makes scraping bugs harder to diagnose.
- Static values: rules support literals (e.g. `pokemon`) when you want to tag every item in a source with a constant.

---

### Phase 4 — Rebuild and verify

**Rebuild path:** Sources > _{your Web source}_ > **•••** (More) > **Rebuild**

- Use **Rebuild**, not **Refresh**, after **any** schema, scraping, or mapping change. Refresh only re-crawls *changed* pages, so already-indexed items will not get the new metadata key.
- Wait for source status to return to **Up to date** before validating — partial rebuilds yield inconsistent facet values.

**Verify in Content Browser**

**Path:** Content > **Content Browser**

1. Filter to the source you just rebuilt.
2. Open a representative item (e.g. `https://pokemondb.net/pokedex/bulbasaur`).
3. Confirm the new field appears with expected value(s) — for `pokemonability`, both `Overgrow` and `Chlorophyll` (hidden) on Bulbasaur.
4. Check **at least one multi-form species** (e.g. Mewtwo, Charizard) to confirm the `:first-of-type` scoping isolated the main-form values.
5. Check a single-value species to confirm multi-value handling doesn't choke on one entry.

**Verify the field reaches search hits (not just Content Browser):** Content Browser shows every stored field on an item, but Headless only returns custom fields when they are listed in `fieldsToInclude` — see Phase 5. Until that's done, the field will look populated in Admin and missing in the app, which is expected.

**Troubleshooting — Content Browser shows `pokemonability` but the Ability panel has no checkboxes**

1. **Facet flag on the field** — Admin → Content → Fields → `pokemonability` → ensure **Facet** is enabled. If this is off, items still store the value (visible in Content Browser) but the Search API returns **no facet buckets** for that field, so Headless shows an empty list.
2. **Multi-value facet** — For multiple abilities per species, enable **Multi-value facet** on `pokemonability`. If abilities were scraped as separate values or as one semicolon-joined string, facet behavior still requires the field to be configured for faceting; multi-value affects how values are split in the index.
3. **Mapping** — Sources → your Web source → Mappings: confirm a rule maps `%[pokemonability]` (or equivalent) onto the **`pokemonability`** field, not a typo’d name.
4. **Rebuild** — After changing the field definition, run a **Rebuild** (not only Refresh) and wait until the source is **Up to date**.
5. **Browser / dev server** — After changing `search-instance.ts`, do a **hard refresh** (or restart `npm run dev`) so the Headless engine rebuilds with the new facet controller.
6. **Search response** — In DevTools → Network, open the Coveo **search** POST response JSON. Under `facets`, find the facet whose `facetId` or `field` is `pokemonability`. If that facet is missing or `values` is empty while Content Browser has data, the problem is index configuration (steps 1–4), not the React UI.

---

### Phase 5 — Wire it into the app

This is the only phase that lives in this repo. See [application-components.md](./application-components.md) for full file layout. Minimum touchpoints for any new facet:

| File | Change |
|---|---|
| `web/src/coveo/search-instance.ts` | Add the new field name to **`fieldsToInclude`** in `buildResultList`. Add a new **`buildFacet`** entry with an appropriate `numberOfValues`. Extend the `SearchControllers` type. |
| `web/src/components/search/SearchInterface.tsx` | Add a kebab-case id to **`PRODUCT_FILTER_IDS`**. Subscribe to the new controller via `useCoveoController`. Render a new **`ProductFacetFilterSection`** + `ProductFacetOptionRow` block in the sidebar — reuses existing chrome, no new components. |
| `web/src/components/search/SearchInterface.tsx` (optional) | Surface the value on **`PokemonCard`** under the Types line for visibility, using the same typography (`text-sm text-zinc-600 dark:text-zinc-400`). |
| `web/src/app/globals.css` | Add the new `[data-product-filter="…"]` id to the styling-hooks comment so it's discoverable for custom CSS. |

**`numberOfValues` guidance** (raise after observing real cardinality)

| Field type | Distinct values | Suggested cap | Today's setting |
|---|---|---|---|
| Type | ~18 | 25 | 25 |
| Generation | ~9 | 15 | 15 |
| Ability | 300+ across full dex | 50 (start), tune | 50 |
| BST tier (planned) | ~5 buckets | 10 | TBD |

---

## 2. Quick checklist (copy into PR description for new facets)

```
[ ] Phase 1 — Field
    [ ] Field <name> created (lowercase, matches sibling fields)
    [ ] Type set correctly (String / Integer)
    [ ] Facet = Yes
    [ ] Multi-value Facet set per data shape
    [ ] Description filled in
    [ ] Assigned to project (if applicable)
[ ] Phase 2 — Web Scraping
    [ ] Metadata name == field name
    [ ] Selector tested against ≥2 representative pages
    [ ] Selector uses attribute/text anchors over nth-child where possible
    [ ] Selector scoped to avoid multi-form contamination
[ ] Phase 3 — Mapping
    [ ] Field selected from dropdown (not free-text)
    [ ] Rule == %[<name>]
[ ] Phase 4 — Rebuild & verify
    [ ] Rebuild (not Refresh) triggered
    [ ] Source status back to Up to date
    [ ] Bulbasaur (multi-value), single-value, multi-form spot-checks all pass
[ ] Phase 5 — App
    [ ] fieldsToInclude updated
    [ ] buildFacet added with appropriate numberOfValues
    [ ] PRODUCT_FILTER_IDS extended
    [ ] ProductFacetFilterSection rendered in sidebar
    [ ] globals.css doc-comment extended
    [ ] (Optional) PokemonCard line surfacing the value
[ ] Smoke test
    [ ] Panel renders with the same chrome as existing facets
    [ ] Values populate after rebuild completes
    [ ] Toggling filters results; cross-facet counts update (logical AND across groups, OR within a group)
```

---

## 3. Quick reference: Admin Console URLs

Replace `{orgId}` with your organization id (visible in any Console URL after login).

| Section | Path |
|---|---|
| Sources | `#/{orgId}/content/sources/` |
| Fields | `#/{orgId}/content/fields/` |
| Content Browser | `#/{orgId}/content/browser/` |
| API Keys | `#/{orgId}/organization/apikeys/` |
| Search Pages | `#/{orgId}/search/pages/` |

---

## 4. Out of scope (here)

- **Search-token issuance** for production — needs a backend endpoint. Not implemented; see [design-decisions.md](./design-decisions.md) DD-3.
- **Query Pipeline rules** (boosts, stop words, ranking) — configured under Search > Query Pipelines; no change required for the current challenge scope.
- **Coveo ML** (Query Suggest, ART) — out of scope for the initial deliverable.
