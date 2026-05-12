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
| Selector type | CSS (XPath is also available — CSS chosen project-wide; see "Selector design principles" below and the **§1 "Worked example — BST"** "Selector style rejected" note for the postmortem on jsoup pseudo-classes) |
| Selector value | `main table.vitals-table:first-of-type td a[href^="/ability/"]::text` |

**Default vs Add Configuration**

- **Default** is fine while one selector set covers every URL the source crawls (current state for this project — every Pokémon page uses the same template).
- **Add Configuration** + URL filter when different page templates need different selectors (e.g. if a future Moves source shares the same crawl with a different DOM).

**Selector design principles** (full discussion: [design-decisions.md DD-13](./design-decisions.md))

- Prefer **page-level meta tags** (`meta[property="og:image"]`) when the data exists there — most stable.
- Prefer **attribute filters** (`a[href^="/ability/"]`) over **DOM position** (`tr:nth-child(6)`) — survives row reorders and minor template edits.
- **Scope to the relevant region** (e.g. `table.vitals-table:first-of-type`) so multi-form species pages don't poison values.
- **Use plain CSS3 only** — `:has()` / `:matchesOwn()` jsoup pseudo-classes have caused asymmetric failures in this project; see the worked BST example below and DD-13 for the postmortem.

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
| BST | 5 tier ranges (numeric facet) | n/a (fixed `currentValues`) | 5 (see `BST_TIERS`) |

---

### Worked example — BST + six individual stats (numeric fields)

The Ability example (§1) covers a **multi-value String** field with one selector. BST is structurally different on **three** axes worth documenting:

1. **Numeric** (Type = `Integer 32` — or `Long` in higher-tier orgs; **not** `String`) — required for range facets, sorting, and ranking expressions.
2. **Seven fields at once**, not one — same scrape pass captures the whole stats table.
3. **Bucketing happens in the app**, not in the index — the facet uses `buildNumericFacet` with fixed `currentValues` driven by `BST_TIERS` in `web/src/coveo/search-instance.ts`.

#### Phase 1 — Create seven integer fields

**Path:** Content > Fields > **Add Field** (repeat ×7)

| Field name | Type |
|---|---|
| `pokemonbst` | **Integer 32** |
| `pokemonhp` | **Integer 32** |
| `pokemonattack` | **Integer 32** |
| `pokemondefense` | **Integer 32** |
| `pokemonspatk` | **Integer 32** |
| `pokemonspdef` | **Integer 32** |
| `pokemonspeed` | **Integer 32** |

**Coveo auto-configures the right flags the moment you pick Integer 32:**

- **Facet** is auto-enabled (and locked) — integers are facetable.
- **Sortable** is auto-enabled (and locked) — integers are sortable.
- **Multi-value facet** is disabled (and locked) — integer fields are single-value in Coveo's schema.

So in practice, the only choice that matters in Phase 1 for numeric fields is the **Type** dropdown. Pick `Integer 32` and everything else slots into place.

**Capacity note:** Integer 32 holds values up to ±2.1 billion — BST max is ~720 and the highest individual stat is ~255, so we're using less than 0.0001% of the field's range. `Long` (64-bit) is offered in non-trial orgs but adds nothing here — Integer 32 is the correct, efficient choice for stat-style integers.

**About Facet vs Multi-value facet on Integer 32:** Only `pokemonbst` is rendered as a facet in the UI today; the six per-stat fields' auto-enabled Facet flag is harmless (it just makes facets *available* — the app only requests the ones it builds controllers for) and useful insurance against future per-stat facet requirements. The six exist primarily to fuel sorting (`buildSort` on `pokemonspeed` desc for "fastest Pokémon") and ranking expressions. The cost to add them at the same time is two extra minutes of admin work, zero rebuilds later.

**Critical trap:**

- **Type = `String` instead of `Integer 32`** silently breaks numeric facets: the field is populated, but `buildNumericFacet` ranges return zero counts because Coveo can't compare strings as numbers. Content Browser will show the value (e.g. `"534"`) and everything will look correct except the facet.

#### Phase 2 — Seven scraping selectors (position-anchored, pure CSS3)

**Path:** Sources > _{your Web source}_ > Edit > **Web Scraping** > **Metadata to extract** (Add 7 entries)

| Metadata name | Selector value | What it captures |
|---|---|---|
| `pokemonhp` | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(1) td.cell-num:first-of-type::text` | HP integer |
| `pokemonattack` | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(2) td.cell-num:first-of-type::text` | Attack |
| `pokemondefense` | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(3) td.cell-num:first-of-type::text` | Defense |
| `pokemonspatk` | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(4) td.cell-num:first-of-type::text` | Special Attack |
| `pokemonspdef` | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(5) td.cell-num:first-of-type::text` | Special Defense |
| `pokemonspeed` | `#dex-stats ~ div.resp-scroll tbody tr:nth-of-type(6) td.cell-num:first-of-type::text` | Speed |
| `pokemonbst` | `#dex-stats ~ div.resp-scroll tfoot td.cell-num:first-of-type::text` | Base Stat Total |

**How each piece works:**

- **`#dex-stats ~ div.resp-scroll`** — pokemondb's Base Stats section is bracketed by `<div id="dex-stats">` (empty anchor div) followed by `<h2>Base stats</h2>` followed by `<div class="resp-scroll">` (which wraps the table). The general-sibling combinator `~` skips the `<h2>` and lands on `div.resp-scroll`. The `id="dex-stats"` is unique per HTML spec, so this anchors precisely to the stats section — **not** the structurally identical `table.vitals-table` instances used elsewhere on the page (Pokédex data, Training, Breeding).
- **`tbody tr:nth-of-type(N)`** — Nth row inside `tbody`. The stat order on pokemondb is canonical across every Pokémon page in the dex: HP, Attack, Defense, Sp. Atk, Sp. Def, Speed.
- **`td.cell-num:first-of-type`** — pokemondb wraps each stat row in four cells: `<th>label</th> <td class="cell-num">value</td> <td class="cell-barchart">bar</td> <td class="cell-num">level-100 min</td> <td class="cell-num">level-100 max</td>`. We want the **first** `cell-num` (the actual stat); the two trailing ones are projection artifacts.
- **`tfoot td.cell-num:first-of-type`** for BST — the `Total` row lives in `<tfoot>`, not `<tbody>`, so it needs its own branch.

**Selector style rejected: jsoup pseudo-classes (`:has`, `:matchesOwn`).** An earlier draft used text-anchored selectors like `tr:has(> th:matchesOwn(^HP$))`. They look more robust on paper (survive row reorders), but in practice produced an asymmetric failure on first rebuild — `pokemonhp` extracted as `0` and the other six fields absent entirely. The `:has` / `:matchesOwn` combination interacts unpredictably with Coveo's scraping pipeline (likely regex-escaping quirks in the config UI for selectors containing `\.`). Stick with pure CSS3 here; pokemondb hasn't reordered the stats table in 20 years.

**Multi-form scoping:** `id="dex-stats"` appears **once per page** (HTML spec — IDs must be unique). On multi-form pages (Charizard, Mewtwo, Terapagos, …), alternate forms render their own stats tables under different headings (`<h3>` or `<details>` panels), but only the default form's table is preceded by `#dex-stats`. So scoping by ID gives us the default form's BST automatically — verify against Charizard `pokemonbst: 534` (not Mega's 634).

#### Phase 3 — Seven mappings

**Path:** Sources > _{your Web source}_ > **Mappings** > **Add** > **Mapping** (×7)

Each mapping is the same trivial shape: Field = `pokemonXXX`, Rule = `%[pokemonXXX]`. Seven separate rules, one per field.

#### Phase 4 — Rebuild and verify

After **Rebuild** completes, in **Content Browser** pick a representative entry and confirm:

| Species | Expected BST | Notes |
|---|---|---|
| Bulbasaur | 318 | Generation 1, average tier |
| Charizard | 534 | Multi-form page → must be 534 (default), **not** 634 (Mega X/Y) |
| Garchomp | 600 | Pseudo-Legendary tier (580+) |
| Mewtwo | 680 | Legendary tier, multi-form page |
| Caterpie | 195 | Frail tier (<300) |

Also spot-check one per-stat field on the same species (e.g. Charizard `pokemonspeed = 100`) to confirm the matchesOwn selectors are landing on the right row.

#### Phase 5 — App wiring (already shipped)

| File | What was changed |
|---|---|
| `web/src/coveo/search-instance.ts` | Imported `buildNumericFacet`/`NumericFacet`; added `bstFacet` controller; exported `BST_TIERS` + `bstTierForRange()`; added `pokemonbst` to `fieldsToInclude`. |
| `web/src/components/search/SearchInterface.tsx` | Added `pokemonBst` to `PRODUCT_FILTER_IDS`; new "Base stat total" panel with empty-state hint; BST chip in `PokemonCard` header (`bstFromRaw` helper). |
| `web/src/app/globals.css` | Added `[data-product-filter="pokemon-bst"]` to the styling-hooks comment. |

No app changes are needed for the six per-stat fields — they sit in the index as fuel for future `buildSort` / ranking expressions. Including them in `fieldsToInclude` is optional and only needed if the UI starts displaying them.

---

## 2. Add a Featured Result (result-ranking pin)

Pin one or more specific items to the top of results for a given query. Pure Admin work — no app code, no rebuild, no ML, no analytics warm-up. Best fit for **deliberate curation** (`pokemon` → Pikachu, `starter` → Bulbasaur+Charmander+Squirtle, `legendary` → Mewtwo+…) rather than relevance tuning at scale.

**Path:** Search > Query Pipelines > _your pipeline_ > **Result ranking** > **Add rule**

In the modern Coveo Console, all promote/boost/bury/filter rules live together under **Result ranking**. The "Featured" modifier corresponds to what older docs and APIs call a **Featured Result** (sometimes "Promoted Result").

| Setting | Value (Pikachu pin example) | Notes |
|---|---|---|
| Modifier | **Featured** | Other modifiers in this UI: Boost (push up by score), Bury (push down), Filter (hide). Featured is the only one that pins to a specific position. |
| Rule name | "Pikachu Pokédex pin (`pokemon`)" | Free text; this is the column you'll scan in the rules list. Use a convention like `<species> pin (<trigger>)`. |
| Documents | Pick the species page by **URI** (`https://pokemondb.net/pokedex/pikachu`) | URI-based selection survives title/metadata edits. Multiple documents can be pinned to the same trigger; **list order = display order**. |
| If query | `is pokemon` (exact) **or** `contains starter` | Common operators: `is exactly`, `contains`, `starts with`, `matches` (regex), or **Always**. Avoid **Always** — it pins the same item across every query. |
| Condition (optional) | Leave blank if using the default pipeline | If you ever isolate to a hub-bound pipeline, a `searchHub == "PokemonSearch"` condition keeps Admin testing from triggering the pin. |

### What a Featured Result does and doesn't do

- **Does:** unconditionally place the named item at the top (or in your specified order) when the trigger matches.
- **Does not:** influence the ranking of any other result. Everything else stays relevance-driven.
- **Still respects facets.** If a user filters Type=Fire and your pin is Pikachu (Electric), Pikachu is filtered out — Featured Result does not override facet selections.
- **Silently empty if filtered out.** No fallback item, no error.
- **Goes through the active query pipeline.** Affects the search hub(s) routed to that pipeline.

### Verification

1. Run the trigger query in the app (or in Admin → Search Pages editor). The pinned item should be at position 1.
2. **DevTools → Network** → Coveo `search` POST → response JSON. The featured hit carries a flag (`isFeaturedResult` / `rankingInfo` block depending on response shape) — useful if you ever want to render a "Featured" badge on `PokemonCard`.
3. In Admin → Result ranking, the rules list shows **Last modification** and lets you toggle each rule on/off without deleting it.

### Quick checklist

```
[ ] Modifier: Featured
[ ] Rule name follows team convention
[ ] Documents picked by URI (not just title — verify the URI matches /pokedex/{slug})
[ ] If query: explicit operator + value (NOT "Always")
[ ] Condition: searchHub binding if isolating to a hub-bound pipeline
[ ] Tested in the app at least once
```

---

## 3. Add and associate a Machine Learning model

The ML lifecycle in Coveo is **three discrete steps**: create the model, associate it to a query pipeline, and consume its output in the app. Each step happens in a different Admin section (or in the case of consumption, in code). The same workflow applies to **Query Suggestions (QS)**, **Automatic Relevance Tuning (ART)**, **Relevance Generative Answering (RGA)**, **Smart Snippets**, **Dynamic Navigation Experience (DNE)** — only the model type and the consumption code differ.

**Worked example:** `pokemon_QS` (Query Suggestions). Substitute model type for ART/RGA/etc.

### Phase 1 — Create the model

**Path:** Machine Learning > **Models** > **Add model**

Or use the shortcut links on a pipeline's **Overview** tab ("Create a new ART model" / "Create a new QS model" panel). Same wizard.

| Setting | Value for `pokemon_QS` | Notes |
|---|---|---|
| Model name | `pokemon_QS` | Lowercase + underscore convention; suffix the type (`_QS`, `_ART`, `_RGA`) so a pipeline's Machine Learning tab is self-documenting. |
| Model type | **Query Suggestions** | Other options: ART, RGA, Smart Snippets, DNE, Recommendations, Case Assist Classification, etc. Trial orgs may not include all. |
| Sources | Select your indexed source(s) — `PokemonDB Crawl` | Restricts which content the model trains on. For a single-source org, just pick everything. |
| Project assignment | `PokemonDB Challenge` | Lets the model show up under Projects → Resources → Machine Learning Models. Optional but tidy. |
| Advanced options | Defaults are fine | E.g. for QS: filter expressions, language, candidate-count limits — unnecessary at this stage. |

**Initial status will be "Limited"** with a warning like "Build issues exist that may affect model performance." This is normal — it means the model exists but has insufficient training data (candidate count typically `0` at creation). It is **not** an error.

### Phase 2 — Associate the model to a query pipeline

A model that isn't associated to a pipeline does nothing — it just sits in the Models list. Association is what makes the pipeline route queries through the model.

**Path:** Search > Query Pipelines > _your pipeline_ > **Machine learning** > **Associate model**

| Setting | Value | Notes |
|---|---|---|
| Model | `pokemon_QS` | Dropdown only shows models compatible with this pipeline + this org. |
| Condition (optional) | **Leave blank** for unconditional firing on this pipeline | A condition would scope the model to specific search hubs, locales, IPs, etc. With a single default pipeline already catching everything, a condition adds nothing. |

After saving, the **Machine learning** tab shows the association with a **Status** column. The hint banner (*"Models are evaluated in the order in which they appear"*) is only relevant if you have **multiple models of the same type** — Coveo evaluates them top-down and uses the first whose condition is satisfied.

### Phase 3 — Consume the model output in the app

This is where each model type diverges. The model produces output, but the app has to **opt in to read it**.

| Model type | What it produces | App-side opt-in |
|---|---|---|
| Query Suggestions | `state.suggestions: Suggestion[]` on the SearchBox controller | `buildSearchBox(e, { options: { numberOfSuggestions: 8 } })` — `0` disables. Render `state.suggestions` in a combobox dropdown (see `SearchBoxWithSuggestions` in `web/src/components/search/SearchInterface.tsx`). |
| Automatic Relevance Tuning | Re-ranks the existing result list based on click patterns | **Nothing.** ART runs at the pipeline level; the app's `result.list` is already reordered. App must emit analytics events (Headless does this by default). |
| Relevance Generative Answering | Streamed LLM answer + citations | `buildGeneratedAnswer(engine)` controller, render `state.answer` and `state.citations` above results. |
| Smart Snippets | Single best-passage answer | `buildSmartSnippet(engine)` controller, render `state.answer` and `state.questionAnswered` above results. |
| Dynamic Navigation Experience | Decides which facets to display per query | Migrate from per-controller `buildFacet` to **`buildFacetGenerator`** (larger refactor). |

### Phase 4 — Verify and warm up

**Verification (immediate):**

1. **Network panel:** open DevTools → Network. For QS, there should be a `querySuggest` POST when you focus/type in the search box. For ART, look for `mlGenerateRequestId` or a `rankingInfo` block on hits in the `search` response. For RGA, a `genqa` or `generated` POST stream.
2. **Admin → Machine Learning > Models > _your model_:** `Association` column should show the pipeline name (no longer "None").

**Warm-up (over time):**

ML models train from **analytics events** the app emits — primarily `search`, `searchQuerySuggest`, `documentClick`, and `genqa` interactions. Until traffic accumulates:

- **QS** model stays "Limited" with `0 candidates` and `state.suggestions` is empty even when the wiring is correct.
- **ART** has nothing to re-rank from and behaves identically to baseline relevance.
- **RGA** still answers (the LLM doesn't need traffic) but citations may be less tuned.

**Trial orgs typically rebuild models on a schedule** (often daily). Each rebuild incorporates the prior period's analytics. To seed faster for a demo:

- Manually run a representative spread of searches (`pikachu`, `bulbasaur`, `charizard`, `dragon`, `legendary`, `intimidate`, etc.).
- Click into results — `documentClick` is the strongest training signal for QS and ART. **App-side wiring is in place** (per-card `buildInteractiveResult.select()` in `PokemonCard`), so every card click in the live app emits one `documentClick` event before navigating to `/pokemon/[slug]`.
- For RGA, ask natural-language questions ("which Pokémon learn Bulk Up?") and rate the answers if your UI supports it.

**Automated warm-up (optional):** A Playwright seeder lives in **`tools/seed-ml/`** with its own `package.json`, so **`npm install` in `web/` does not pull Playwright** — contributors who only build the Next app get a clean, smaller install.

```bash
cd web && npm install && npm run dev    # terminal 1 — app must be running

cd tools/seed-ml && npm install
npm run setup                           # one-time: Chromium binary (~150 MB)
npm run seed                            # terminal 2 — drives the real UI
```

Useful variations (always from `tools/seed-ml/`):

| Command | What it does |
|---------|---------------|
| `npm run seed:headed` | Same run, with the browser visible (good for debugging selectors). |
| `npm run seed -- --bucket qs` | Only Query Suggestions seeds. |
| `npm run seed -- --bucket rga` | Only natural-language RGA seeds. |
| `npm run seed -- --bucket facets` | Only facet-toggle seeds. |
| `npm run seed -- --loops 3 --throttle 800` | Repeat the full corpus 3× with 800 ms between actions. |
| `npm run seed -- --url http://localhost:3001` | Point at a different port (or a hosted preview). |

Seed lists live in [`tools/seed-ml/queries.json`](../tools/seed-ml/queries.json); edit freely. The runner emits the same Coveo analytics events a real user does (`search`, `searchQuerySuggest`, `facetSelect`, `genqa.citationClick`). **It does not currently click result cards**, so it does not emit `documentClick` events even though the app would on real clicks. Adding a fourth bucket that opens a result → detail page (`Link` is the entire card) would feed ART training directly — a natural follow-up if reviewer traffic alone isn't enough to move `pokemon_ART` past "Build in progress."

### Impacts and trade-offs

| Impact | Notes |
|---|---|
| **Latency** | QS adds a small parallel request when typing (cached aggressively). RGA streams a response that can take several seconds — render a loading state. ART is server-side and free. |
| **Cost / quota** | RGA consumes paid LLM quota in production orgs (free in most trials). QS, ART, Smart Snippets are typically included in standard licenses. |
| **Determinism** | ML models are non-deterministic over time — results for the same query change as the model trains. Featured Results (§2) are the deterministic counterpart. |
| **Privacy** | All three models train on usage analytics. Your Anonymous Search API key (dev only) emits non-PII events; production search-token flows let you scope analytics per user. |
| **Pipeline coupling** | An associated model only fires for queries that hit **that** pipeline. Multi-pipeline orgs need to associate the model on each pipeline that should benefit, or use **Groups & campaigns** to consolidate routing. |

### Quick checklist

```
[ ] Phase 1 — Create model
    [ ] Naming convention (lowercase + _<TYPE> suffix)
    [ ] Sources selected
    [ ] Project assigned (optional but tidy)
[ ] Phase 2 — Associate to pipeline
    [ ] Pipeline = the one your app's searchHub routes to
    [ ] Condition deliberately left blank or scoped on purpose
[ ] Phase 3 — App integration
    [ ] Controller built with the right opt-in option
    [ ] State subscribed via useCoveoController
    [ ] UI renders the model output (or has a graceful empty state)
[ ] Phase 4 — Verify / warm up
    [ ] Network panel shows the model-specific request firing
    [ ] Model status moves from "Limited" toward populated as traffic grows
    [ ] Smoke-tested with a representative spread of queries
```

---

## 4. Quick checklist (copy into PR description for new facets)

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

## 5. Quick reference: Admin Console URLs

Replace `{orgId}` with your organization id (visible in any Console URL after login).

| Section | Path |
|---|---|
| Sources | `#/{orgId}/content/sources/` |
| Fields | `#/{orgId}/content/fields/` |
| Content Browser | `#/{orgId}/content/browser/` |
| API Keys | `#/{orgId}/organization/apikeys/` |
| Search Pages | `#/{orgId}/search/pages/` |
| Query Pipelines | `#/{orgId}/search/pipelines/` |
| Result Ranking (per pipeline) | `#/{orgId}/search/pipelines/{pipelineId}/result-ranking/` |
| Machine Learning Models | `#/{orgId}/machine-learning/models/` |
| Pipeline ML associations | `#/{orgId}/search/pipelines/{pipelineId}/ml/` |
| Projects | `#/{orgId}/organization/projects/` |

---

## 6. Out of scope (here)

- **Search-token issuance** for production — needs a backend endpoint. Not implemented; see [design-decisions.md](./design-decisions.md) DD-3.
- **A/B testing pipelines** — configured under Search > Query Pipelines > A/B test; not used in the current single-pipeline setup.
- **Indexing Pipeline Extensions (IPE)** — Python scripts that run during indexing. Considered for BST tier bucketing but **explicitly rejected** in favor of client-side tier ranges (see [next-steps.md](./next-steps.md) §2 "Why client-side ranges"); not in use anywhere today.
