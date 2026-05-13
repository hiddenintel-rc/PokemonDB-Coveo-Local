# Roadmap and platform optimizations

**Status legend:** Sections are tagged **Shipped**, **Planned**, or **Deferred**. Procedural how-to for Admin work lives in [coveo-admin-playbook.md](./coveo-admin-playbook.md); this file captures *what* and *why*, not click-by-click steps.

This file mixes two concerns on purpose: (1) a **changelog-style** record of major features that shipped after the first search MVP — the **Ability** facet, the **BST** facet (app + Admin; values in Content Browser), and the **`/pokemon/[slug]`** detail route (see [application-components.md](./application-components.md)) — and (2) a **forward roadmap** of Coveo platform optimizations (relevance, ML, query pipeline), with each item flagged as Shipped, Planned, or Deferred. Legendary/Mythical-style classifications remain explicitly out of scope.

---

## 1. Ability facet — **Shipped**

**Status:** Live in `web/` and indexed in Coveo. Field `pokemonability` is multi-value, facet-enabled; selector is `main table.vitals-table:first-of-type td a[href^="/ability/"]::text` (attribute-anchored, no `tr:nth-child`). UI uses the third `ProductFacetFilterSection` panel and surfaces abilities on `PokemonCard` (with semicolon-string handling).

**Reference:** see [coveo-admin-playbook.md §1](./coveo-admin-playbook.md#1-add-a-new-facet-end-to-end) for the worked example used to build it; [application-components.md](./application-components.md) for the code touchpoints.

**Future tuning** (only if Ability needs more polish):

- Search-within-facet UI (covered in §3 below — applies to any large-cardinality facet).
- Raise `numberOfValues` from 50 if Content Browser shows truncation.
- Toggle **Free text search** on the field so queries like `intimidate` rank species directly (see §3).

---

## 2. BST (base stat total) facet — **Shipped**

### Design summary

Single-number summary of stat budget. Used as the **primary** Stats facet on the search page, rendered as five labeled community tiers (see "Tiers" below). Alongside `pokemonbst`, the scrape captures the six individual stats (HP, Attack, Defense, Sp. Atk, Sp. Def, Speed) as Integer 32 fields — not surfaced as facets today, but **available in the index for sorting, ranking expressions, or future per-stat facets** at zero additional admin cost.

### Tiers (driving the numeric facet)

| Range (`[start, end)`) | Label in the UI |
|---|---|
| `0–300` | **Frail** (<300) |
| `300–450` | **Average** (300–449) |
| `450–520` | **Strong** (450–519) |
| `520–580` | **Very strong** (520–579) |
| `580–1000` | **Legendary** (580+) |

Boundaries live in **`BST_TIERS`** in `web/src/coveo/search-instance.ts` — single source of truth for both `buildNumericFacet({ currentValues })` and the rendered labels. Bucketing is **presentation logic, not data**: change `BST_TIERS` and the UI updates without a re-index. The raw `pokemonbst` integer stays in the index for sorting and ranking expressions.

### Source on pokemondb

**Base stats** table, one row per stat plus a `Total` row. The first numeric cell on each row is the value to capture; multi-form species (Charizard, Mewtwo, Deoxys, …) render multiple Base Stats tables on a single page — capture only the first.

### Coveo platform (BST) — complete

| Step | Action |
|------|--------|
| Fields (7) | Created in `roelc_Pokemon`: **`pokemonbst`**, **`pokemonhp`**, **`pokemonattack`**, **`pokemondefense`**, **`pokemonspatk`**, **`pokemonspdef`**, **`pokemonspeed`** — all **Type = `Integer 32`** (Coveo auto-locked Facet=Yes / Sortable=Yes / Multi-value=No for integers). |
| Scraping | Seven CSS3 selectors anchored on `#dex-stats ~ div.resp-scroll` (the section's unique-ID anchor). Exact selectors in [coveo-admin-playbook.md §1 — BST extension](./coveo-admin-playbook.md#worked-example-bst--six-individual-stats-numeric-fields). An earlier draft used `:has`/`:matchesOwn` text-anchored selectors and produced asymmetric failures on rebuild — switched to position-anchored CSS3 once the actual DOM was inspected; see playbook's "Selector style rejected" note for the postmortem. |
| Mappings | One mapping per field: rule = `%[pokemonbst]` etc. ✅ |
| Rebuild | Completed; values verified against Golbat (`pokemonhp 75 + pokemonattack 80 + pokemondefense 70 + pokemonspatk 65 + pokemonspdef 75 + pokemonspeed 90 = pokemonbst 455`) — the sum identity is itself the proof that all seven selectors landed on the right cells, not just a coincidentally-matching one. |

### Application (`web/`) — **complete**

| Touchpoint | Status |
|------|--------|
| `search-instance.ts` — `pokemonbst` in `fieldsToInclude`; **`buildNumericFacet`** with explicit `currentValues` driven by `BST_TIERS`; `BST_TIERS` + `bstTierForRange()` helper exported | ✅ |
| `SearchInterface.tsx` — new `Base stat total` panel (5 labeled tiers, mirrors existing facet chrome); `data-product-filter="pokemon-bst"`; empty-state hint when all counts are 0 | ✅ |
| `PokemonCard` — **BST** line on the card (`tabular-nums`, sky accent when next to national №); reads `pokemonbst` from `result.raw` with string/number tolerance | ✅ |
| `globals.css` — `[data-product-filter="pokemon-bst"]` added to the styling-hooks comment | ✅ |

The app degrades gracefully if `pokemonbst` is missing from the index: the five tier rows still render but with `0` counts, and an inline hint points to the Admin steps needed.

### Why client-side ranges (rejected: Indexing Pipeline Extension)

Earlier drafts proposed deriving a `pokemonbsttier` field at scrape time via an Indexing Pipeline Extension (Python script in Coveo, post-crawl). **Rejected** in favor of client-side ranges:

- Bucket boundaries are **presentation logic**, not data — adjusting "Strong starts at 460" via IPE would require a full re-index.
- Keeping the raw integer in the index keeps sorting / ranking expressions / future granular facets open.
- IPE is a separate Coveo construct (Python in-cloud) — operational surface area for no real win here.

---

## 3. Coveo platform optimizations — **Planned**

Discovered during a platform-tools review (Admin → Search > Query Pipelines, Admin → Machine Learning). Ranked by **demo impact ÷ setup effort** for this dataset. Pick top-down; each item is independent unless noted.

### 3.1. Featured Result / pinning — **quick win**

**Where:** Search > Query Pipelines > _your pipeline_ > **Featured results**.
**Pin:** e.g. `pokemon` → Pikachu, `starter` → Bulbasaur/Charmander/Squirtle. **5-minute** Admin-only change. No app code. Massive first-impression payoff during demos.

### 3.2. Thesaurus / synonyms — **quick win**

**Where:** Search > Query Pipelines > _your pipeline_ > **Thesaurus**.
Aliases bridging casual phrasing to indexed values:

| Phrase user types | Mapped to |
|---|---|
| `fire-type`, `fire type` | `fire` |
| `gen 1`, `generation 1`, `gen one` | `Generation 1` |
| `legendary` | (manual list of legendary species names) |
| `starter` | (manual list of starter species names) |

Admin-only. Keeps the React app untouched.

### 3.3. Free text search on `pokemonability` (and `pokemontype`) — **quick win**

**Where:** Content > Fields > _field_ > **Free text search** (advanced settings).
Today these fields are facet-only. Toggling Free text search makes a query like `intimidate` rank species containing it in the field, not only species whose **body text** happens to mention it. **One toggle + rebuild**, no app code. Also enables `@pokemonability=Intimidate` syntax for power users.

### 3.4. Query Suggestions (QS) model — **Shipped**

**Status:** Live. Coveo model `pokemon_QS` (Query Suggestions) is associated to the **default** pipeline with no condition (fires on every query). App reads `state.suggestions` from `buildSearchBox` (`numberOfSuggestions: 8`) and renders a combobox dropdown beneath the input.

**App touchpoints (already done):**

- `web/src/coveo/search-instance.ts` — `buildSearchBox` now passes `options: { numberOfSuggestions: 8 }`.
- `web/src/components/search/SearchInterface.tsx` — new `SearchBoxWithSuggestions` component implementing the WAI-ARIA combobox pattern: `role="combobox"` + `role="listbox"` + `aria-activedescendant`, ArrowDown/Up navigation, Enter to apply, Escape to close, click-to-pick. Reuses existing emerald focus styling.

**Behavior notes:**

- QS model status is **"Limited"** until a few queries train it. With 0 candidates the dropdown stays empty even when typing — that's the model warming up, not a code defect. After several real searches the suggestions begin to populate.
- `selectSuggestion(value)` updates the search box AND submits, and emits a `searchQuerySuggest` analytics event so the model learns from selections.
- **Warm-up tool (optional):** Playwright seeder under `tools/seed-ml/` — not part of `web/` install. See [coveo-admin-playbook.md §3 Phase 4 — Verify and warm up](./coveo-admin-playbook.md#phase-4--verify-and-warm-up) for usage and `tools/seed-ml/queries.json` for the seed corpus.

### 3.5. Search-within-facet on Ability (and Type) — **medium effort, big UX win**

**Where:** App-side change to `buildFacet`'s `facetSearch` options + a small input rendered above the option rows.

- ~300 distinct abilities exceed any reasonable `numberOfValues` cap; users need to type `intim…` to narrow.
- Pattern: `controller.facetSearch.updateText(query)`, render `state.facetSearch.values` instead of (or alongside) the static value list.
- Reuse the existing `ProductFacetOptionRow` for results — no new component primitives.

### 3.6. Relevance Generative Answering (RGA) — **Shipped**

**Status:** App wiring complete. Renders an LLM-synthesized answer with numbered citations above the result list when the active query pipeline produces one. Fails open: if no RGA model is associated to the pipeline (or the trial org doesn't have RGA enabled), `state.answer` stays undefined and the panel stays hidden — no error UI, no broken layout.

**App touchpoints (already done):**

- `web/src/coveo/search-instance.ts` — adds `generatedAnswer` to the controllers via `buildGeneratedAnswer(engine, { fieldsToIncludeInCitations: [...] })`. The `fieldsToInclude` list mirrors `pokemontype` / `pokemongeneration` / `pokemonability` / `pictureuri` so each citation carries our custom fields if we ever want to render thumbnails.
- `web/src/components/search/SearchInterface.tsx` — new `GeneratedAnswerPanel` component above the result list. Handles loading / streaming / answer / cannot-answer / error states, renders citations as numbered chips with `clickUri` links, exposes 👍/👎 feedback wired to `controller.like()` / `controller.dislike()` / `feedbackSubmitted`.

**Admin side (status):**

- Phase 1 — Create model: **Done.** `pokemon_RGA` exists in `roelc_Pokemon` trial org.
- Phase 2 — Associate to default pipeline: **Done.** Status shows **Active** in the default pipeline's Machine learning tab.
- Phase 4 — Verify: **Done.** Seeder run on 2026-05-11 confirmed the panel renders end-to-end — 4 / 10 NL questions produced citations, 6 / 10 produced un-cited answers (typical pattern: list/filter questions vs single-entity questions).

**Behavior notes:**

- Plain-text rendering of the answer (no `dangerouslySetInnerHTML` per security audit). `whitespace-pre-wrap` preserves LLM line breaks; bold/italic/inline links from markdown are rendered as literal characters. Acceptable trade-off; can be revisited with a small markdown parser if needed.
- Citations log click analytics via `logCitationClick(citationId, answerId)` on click — feeds RGA training signal.
- Feedback buttons disable themselves after submission (`feedbackSubmitted`) and a "Thanks!" label confirms the send.
- Analytics mode: the engine is pinned to **`analyticsMode: 'legacy'`** (Coveo UA, `analytics.js`) in `web/src/coveo/search-instance.ts`. Headless v3 defaults to `'next'` (Event Protocol), but Coveo's own v2→v3 guide states that EP is GA only for **Commerce** orgs — for Search / Service / Website / Workplace implementations they instruct non-Commerce projects to use `'legacy'`. Switching back silences the "this mode is not available for Coveo for Service features" warning the panel inherited from `buildGeneratedAnswer`, keeps `pokemon_QS` / `pokemon_RGA` / `pokemon_ART` training on the UA event shape they were designed against, and preserves access to `analyticsClientMiddleware` if we ever need request-time event redaction. Revisit if/when Coveo promotes EP out of closed beta for non-Commerce.
- **Warm-up tool:** From `tools/seed-ml/`, run `npm run seed -- --bucket rga` (after `npm install` there) to submit natural-language questions and follow the first citation per answer (firing `genqa` + `genqa.citationClick`). Use it once the Admin model status moves past "Build in progress". This package is optional and is not installed with `web/`.

### 3.7. Automatic Relevance Tuning (ART) — **Shipped (model + wiring); accumulating signal**

**Status:** Both halves are in place.

**Admin side:** `pokemon_ART` model created and associated to the default pipeline. Status currently **Build in progress** — model is provisioning; will move to **Limited** (or **Active**) after the first nightly rebuild with sufficient analytics signal.

**App side:** `PokemonCard` wraps each card in a Next.js `<Link>` whose `onClick` calls `interactiveResult.select()` on a per-card `buildInteractiveResult` controller. Every result card click emits a `documentClick` analytics event — exactly the signal ART consumes.

**Behavior notes:**

- ART is silent until it has enough click-through patterns; until then results are baseline-relevance ranked. There is no UI surface to "render the ART output" — it operates server-side, re-ordering hits the engine returns.
- Verification path: after a few days of seeder + manual usage, compare baseline ranking for an ambiguous query (e.g. `dragon`) against current ranking. ART will gradually promote frequently-clicked Pokémon for that query.
- Honest demo framing: *"the model is in place, the click signal is wired, and it will learn from real traffic — here's how that scales."*

### 3.8. Ranking expressions (QRE) — **optional**

**Where:** Search > Query Pipelines > _your pipeline_ > **Ranking expressions**.
Examples for nostalgic boost or curated relevance:

```
@pokemongeneration=="Generation 1"^10
@pokemonbst>=600^25   (after BST facet ships)
```

Admin-only. Use sparingly — easy to over-bias and obscure ART.

### 3.9. Passage Retrieval API — **Optional / not started**

**Where:** Coveo Passage Retrieval API (separate endpoint, not a pipeline rule).

- Returns the most relevant **text passages** within indexed documents — feedstock for an LLM or for direct display.
- For pokemondb: useful for the **species blurb / flavor text** sections, less useful for tabular stats.
- A **written point of view** on how you would use Passage Retrieval is a reasonable first deliverable if you are not building against the API yet.

### 3.10. Dynamic Navigation Experience (DNE / Facet Generator) — **deferred for now**

Would require migrating from per-controller `buildFacet` to **`buildFacetGenerator`**. Worth the refactor only when the index has enough candidate facets (15+) for DNE's "show the right facets per query" logic to matter. With 3-4 facets, hand-rolled wins.

**Side note:** adopting `buildFacetGenerator` later would *also* make the **Display name** field in Coveo Admin (e.g. `Pokemon Ability`) drive the React panel heading automatically, replacing the current hard-coded `heading="Ability"` strings.

### Summary — recommended order

| # | Item | Effort | Where it lives |
|---|---|---|---|
| 1 | Featured Result pinning | 5 min | Admin only |
| 2 | Thesaurus / synonyms | 10 min | Admin only |
| 3 | Free text search on custom fields | 1 toggle + rebuild | Admin only |
| ~~4~~ | ~~Query Suggestions~~ — **Shipped** (model status: Limited until training data accumulates) | — | — |
| 5 | Search-within-facet on Ability | ~1 hr app change | App only |
| ~~6~~ | ~~RGA~~ — **Shipped** (model: Active) | — | — |
| ~~7~~ | ~~ART~~ — **Shipped** (model + wiring); model status: Build in progress | — | — |
| 8 | Ranking expressions | Admin only | Admin only |
| 9 | Passage Retrieval POV | Doc only | Docs |
| 10 | DNE / Facet Generator | Larger refactor | Deferred |

Items 1–4 are high-leverage Admin-only polish. Items 5–6 deepen UX on large facets and generative search. Items 7–10 capture ML and platform depth work.

---

## 4. Verification

After indexing:

1. **Content Browser** — spot-check Bulbasaur (dual ability + hidden), a single-ability species, and **one multi-form** species for consistent metadata.
2. **Search API** — confirm new fields appear in **`raw`** when listed in **`fieldsToInclude`** (same lesson as `pictureuri`).
3. **Facet counts** — confirm **`numberOfValues`** is high enough for Ability if not using search-within-facet.

---

## 5. Explicitly deferred

- **Legendary / Mythical / similar taxonomy** — not reliably exposed as a dedicated field on pokemondb species pages; no planned scrape-only facet unless requirements change.
- **DNE / Facet Generator migration** — see §3.10. Revisit when facet count exceeds ~10.

---

## 6. Doc ownership

Keep implementation details that change frequently (exact selectors, field names after Admin rename) in **Admin Console** exports or comments beside scraping JSON if your team maintains them outside git.
