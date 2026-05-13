/**
 * Coveo ML warm-up seeder.
 *
 * Drives the running Next.js app via Playwright (real browser, real UI, real Coveo
 * Headless analytics events) to feed the org's ML models — primarily Query
 * Suggestions (QS) and Relevance Generative Answering (RGA), with incidental
 * signal for Automatic Relevance Tuning (ART) via facet selections.
 *
 * What each bucket actually emits over the wire:
 *   - querySuggestionSeeds  -> `search` events on submit, `searchQuerySuggest`
 *                              events when a dropdown item is selected.
 *   - facetExerciseSeeds    -> `search` + `facetSelect` (and a second `search`
 *                              triggered by the facet toggle).
 *   - naturalLanguageRGASeeds -> `search` + `genqa` request + `genqa.citationClick`
 *                              when a citation is followed.
 *   - artClickSeeds         -> `search` (for the query) + `documentClick` (for
 *                              the targeted card). The click event is the ONLY
 *                              direct training signal Automatic Relevance Tuning
 *                              consumes — without these, ART stays at "0 learned
 *                              queries" regardless of how many searches fire.
 *
 * Smoke test (`tools/seed-ml/smoke.ts`) contributes one additional card click
 * per run as a side-effect of its happy-path assertions, but the `art` bucket
 * is the volume contributor for ART training.
 *
 * Usage (from `tools/seed-ml/` — optional; does not affect `web/` install):
 *   npm install
 *   npm run setup                     # one-time: Chromium binary (~150 MB)
 *   npm run seed                      # default: headless, 1 loop, http://localhost:3000
 *   npm run seed:headed               # watch it run
 *   npm run seed -- --url http://localhost:3001
 *   npm run seed -- --loops 3 --throttle 800
 *   npm run seed -- --bucket rga       # only RGA seeds
 *   npm run seed -- --bucket qs        # only Query Suggestions seeds
 *   npm run seed -- --bucket facets    # only facet seeds
 *   npm run seed -- --bucket art       # only ART click seeds
 *
 * Start the app first: `cd web && npm run dev`
 */

import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type FacetSeed = {
  query: string;
  facetId: "pokemontype" | "pokemongeneration" | "pokemonability";
  value: string;
};

type ArtClickSeed = {
  query: string;
  /** Slug from the result `clickUri` — exact match against the card's `<Link href="/pokemon/{slug}">`. */
  targetSlug: string;
};

type SeedConfig = {
  querySuggestionSeeds: string[];
  facetExerciseSeeds: FacetSeed[];
  naturalLanguageRGASeeds: string[];
  artClickSeeds: ArtClickSeed[];
};

type Bucket = "all" | "qs" | "facets" | "rga" | "art";

const FACET_ID_TO_PRODUCT_FILTER: Record<FacetSeed["facetId"], string> = {
  pokemontype: "pokemon-type",
  pokemongeneration: "pokemon-generation",
  pokemonability: "pokemon-ability",
};

const args = process.argv.slice(2);
const hasFlag = (flag: string): boolean => args.includes(flag);
const getOpt = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i >= 0 && typeof args[i + 1] === "string" ? args[i + 1] : fallback;
};

const URL_TARGET = getOpt("--url", "http://localhost:3000");
const HEADED = hasFlag("--headed");
const LOOPS = Math.max(1, Number.parseInt(getOpt("--loops", "1"), 10) || 1);
const THROTTLE_MS = Math.max(
  0,
  Number.parseInt(getOpt("--throttle", "500"), 10) || 500,
);
const BUCKET = getOpt("--bucket", "all").toLowerCase() as Bucket;

if (!["all", "qs", "facets", "rga", "art"].includes(BUCKET)) {
  console.error(`[seeder] --bucket must be one of all|qs|facets|rga|art (got: ${BUCKET})`);
  process.exit(1);
}

const config: SeedConfig = JSON.parse(
  readFileSync(resolve(__dirname, "queries.json"), "utf8"),
) as SeedConfig;

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

function log(category: string, query: string, action: string): void {
  console.log(`[${ts()}] [${category}] "${query}" — ${action}`);
}

async function isVisibleSoon(locator: Locator, timeoutMs = 500): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

const searchInput = (page: Page): Locator =>
  page.locator('input[type="search"][role="combobox"]');

async function resetSearchBox(page: Page): Promise<void> {
  const input = searchInput(page);
  await input.click();
  await input.fill("");
  // Tiny settle so Headless doesn't conflate the clear with the next keystroke.
  await page.waitForTimeout(50);
}

async function runQuerySuggestionSeed(page: Page, query: string): Promise<void> {
  log("QS", query, "typing");
  await resetSearchBox(page);
  // Per-character typing so the SearchBox controller emits `updateText` for each
  // keystroke — that's what the QS endpoint listens to. `fill()` would set the
  // value in one shot and skip the QS calls entirely.
  await searchInput(page).pressSequentially(query, { delay: 70 });

  // Let the QS round-trip render (querySuggest is a separate POST).
  await page.waitForTimeout(450);

  const firstSuggestion = page.locator('[role="listbox"] [role="option"]').first();
  // 600ms (was 250ms) — a cold QS model returns nothing, but once Coveo has
  // rebuilt the model from a previous seed cycle the dropdown takes longer to
  // appear on a busy dev server than 250ms allows. Bumping the budget lets
  // subsequent runs actually SELECT suggestions, which emits the higher-value
  // `searchQuerySuggest` analytics event in addition to a plain `search`.
  if (await isVisibleSoon(firstSuggestion, 600)) {
    log("QS", query, "selecting first suggestion");
    // mousedown wins over the input's blur handler in SearchBoxWithSuggestions.
    await firstSuggestion.dispatchEvent("mousedown");
  } else {
    log("QS", query, "no suggestion offered — pressing Enter");
    await searchInput(page).press("Enter");
  }
  await waitForSearchToSettle(page);
}

async function runFacetSeed(page: Page, seed: FacetSeed): Promise<void> {
  const productFilterId = FACET_ID_TO_PRODUCT_FILTER[seed.facetId];
  log(
    "FACET",
    seed.query,
    `submit + toggle ${productFilterId}="${seed.value}"`,
  );

  await resetSearchBox(page);
  await searchInput(page).fill(seed.query);
  await searchInput(page).press("Enter");
  await waitForSearchToSettle(page);

  const panel = page.locator(`[data-product-filter="${productFilterId}"]`);
  if (!(await isVisibleSoon(panel, 1000))) {
    log("FACET", seed.query, `panel ${productFilterId} not visible — skipping`);
    return;
  }

  // <details> elements need to be opened (`open` attribute) before children are interactive.
  const isOpen = await panel.evaluate((el) =>
    el instanceof HTMLDetailsElement ? el.open : true,
  );
  if (!isOpen) {
    await panel.locator("summary").click();
  }

  const optionRow = panel.locator(
    `[data-filter-option="${cssEscape(seed.value)}"]`,
  );
  if (!(await isVisibleSoon(optionRow, 1500))) {
    log(
      "FACET",
      seed.query,
      `option "${seed.value}" not present in ${productFilterId} (model may not have indexed it yet)`,
    );
    return;
  }
  // Clicking the checkbox toggles `facet.toggleSelect`, which emits a facetSelect
  // event AND triggers a fresh search.
  await optionRow.locator('input[type="checkbox"]').click();
  await waitForSearchToSettle(page);

  // Untoggle so the next seed starts from a clean filter set.
  if (await isVisibleSoon(optionRow.locator('input[type="checkbox"]:checked'), 250)) {
    await optionRow.locator('input[type="checkbox"]').click();
    await waitForSearchToSettle(page);
  }
}

async function runRGASeed(page: Page, query: string): Promise<void> {
  log("RGA", query, "submitting NL query");
  await resetSearchBox(page);
  await searchInput(page).fill(query);
  await searchInput(page).press("Enter");

  // Wait for the panel to mount. It only renders once the RGA stream has at
  // least started OR cannotAnswer becomes true; if the model isn't associated
  // yet the panel never appears and we skip the citation step.
  const panel = page.locator('[data-region="generated-answer"]');
  const appeared = await isVisibleSoon(panel, 8000);
  if (!appeared) {
    log("RGA", query, "no panel rendered (model may still be provisioning) — moved on");
    await waitForSearchToSettle(page);
    return;
  }

  // Let the LLM stream complete. Citations render incrementally; wait for the
  // "thinking…/answering…" indicator to disappear, with an upper bound.
  await page
    .locator('[data-region="generated-answer"] .animate-pulse')
    .waitFor({ state: "hidden", timeout: 15000 })
    .catch(() => undefined);

  const firstCitation = panel.locator("ol a").first();
  if (await isVisibleSoon(firstCitation, 500)) {
    log("RGA", query, "clicking citation [1]");
    // dispatchEvent('click') fires the React onClick (-> logCitationClick) without
    // performing the default navigation, avoiding spurious new tabs in headless runs.
    await firstCitation.dispatchEvent("click");
  } else {
    log("RGA", query, "answered with no citations — leaving feedback unsent");
  }
}

async function runArtClickSeed(page: Page, seed: ArtClickSeed): Promise<void> {
  log("ART", seed.query, `submit + click /pokemon/${seed.targetSlug}`);

  await resetSearchBox(page);
  await searchInput(page).fill(seed.query);
  await searchInput(page).press("Enter");
  await waitForSearchToSettle(page);

  // Cards render as <Link href="/pokemon/{slug}">; an exact href match is the
  // most stable locator (title text from pokemondb includes long suffixes like
  // "… Pokédex: stats, moves, evolution & locations | Pokémon Database").
  const targetLink = page.locator(`a[href="/pokemon/${seed.targetSlug}"]`).first();
  if (!(await isVisibleSoon(targetLink, 2500))) {
    log(
      "ART",
      seed.query,
      `target /pokemon/${seed.targetSlug} not in first page of results — skipping (consider a more specific query or wait for ART itself to promote it)`,
    );
    return;
  }

  // Clicking the Link fires the PokemonCard's onClick handler which calls
  // `interactiveResult.select()` — the documentClick analytics event ART
  // consumes — BEFORE Next.js navigates to the detail route.
  await targetLink.click();
  await page
    .waitForURL(`**/pokemon/${seed.targetSlug}`, { timeout: 5000 })
    .catch(() => undefined);

  // Reset to home for the next seed. A fresh navigation re-fires
  // executeFirstSearch (an extra blank `search` event per iteration — accepted
  // noise; the click event is the signal that matters for ART).
  await page.goto(URL_TARGET, { waitUntil: "domcontentloaded", timeout: 10000 });
  await searchInput(page).waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
  await waitForSearchToSettle(page);
}

async function waitForSearchToSettle(page: Page): Promise<void> {
  // Wait for the actual Coveo `search` response rather than `networkidle` —
  // Next.js dev mode keeps an HMR WebSocket open, so networkidle never fires.
  // Tolerate the race where the search has already completed before we wait.
  await page
    .waitForResponse(
      (r) => r.url().includes("/rest/search/v2") && r.request().method() === "POST",
      { timeout: 5000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(150);
}

function cssEscape(value: string): string {
  // Playwright's attribute-selector parsing is forgiving but a runtime-safe
  // escape keeps quotes/special chars from breaking the locator if a future
  // seeds.json entry contains them.
  return value.replace(/"/g, '\\"');
}

function pickQueriesForBucket(): {
  qs: string[];
  facets: FacetSeed[];
  rga: string[];
  art: ArtClickSeed[];
} {
  switch (BUCKET) {
    case "qs":
      return { qs: config.querySuggestionSeeds, facets: [], rga: [], art: [] };
    case "facets":
      return { qs: [], facets: config.facetExerciseSeeds, rga: [], art: [] };
    case "rga":
      return { qs: [], facets: [], rga: config.naturalLanguageRGASeeds, art: [] };
    case "art":
      return { qs: [], facets: [], rga: [], art: config.artClickSeeds };
    case "all":
    default:
      return {
        qs: config.querySuggestionSeeds,
        facets: config.facetExerciseSeeds,
        rga: config.naturalLanguageRGASeeds,
        art: config.artClickSeeds,
      };
  }
}

function autoClosePopups(context: BrowserContext, mainPage: Page): void {
  // Result links use target="_blank"; auto-close any popup so the runner stays
  // on the same primary page and stale tabs don't pile up in headed mode.
  // IMPORTANT: filter out `mainPage` — the `page` event fires for it too, and
  // closing it would crash the first `page.goto()` with `frame was detached`.
  context.on("page", (newPage) => {
    if (newPage === mainPage) return;
    newPage.close().catch(() => undefined);
  });
}

async function main(): Promise<void> {
  console.log(`[seeder] target URL : ${URL_TARGET}`);
  console.log(`[seeder] mode       : ${HEADED ? "headed" : "headless"}`);
  console.log(`[seeder] bucket     : ${BUCKET}`);
  console.log(`[seeder] loops      : ${LOOPS}`);
  console.log(`[seeder] throttle   : ${THROTTLE_MS}ms between actions`);

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  autoClosePopups(context, page);

  try {
    await page.goto(URL_TARGET, { waitUntil: "domcontentloaded", timeout: 15000 });
    // Confirm the React app actually mounted by waiting for the search input
    // to be visible. Avoids `networkidle` which is unreliable against a Next.js
    // dev server (HMR WebSocket keeps the connection open indefinitely).
    await searchInput(page).waitFor({ state: "visible", timeout: 10000 });
  } catch (err) {
    console.error(
      `\n[seeder] Failed to load ${URL_TARGET}. Is "npm run dev" running in web/?\n`,
    );
    console.error(err);
    await browser.close();
    process.exit(1);
  }

  // Give the initial executeFirstSearch a moment to complete before we start
  // racing it with seed queries.
  await waitForSearchToSettle(page);

  const buckets = pickQueriesForBucket();
  const totalActions =
    (buckets.qs.length +
      buckets.facets.length +
      buckets.rga.length +
      buckets.art.length) *
    LOOPS;
  let actionIndex = 0;

  for (let loop = 1; loop <= LOOPS; loop++) {
    console.log(`\n[seeder] === loop ${loop} of ${LOOPS} ===\n`);

    for (const q of buckets.qs) {
      actionIndex++;
      try {
        await runQuerySuggestionSeed(page, q);
      } catch (err) {
        console.error(`[seeder] QS "${q}" failed:`, err);
      }
      console.log(`[seeder] progress: ${actionIndex}/${totalActions}`);
      await page.waitForTimeout(THROTTLE_MS);
    }

    for (const seed of buckets.facets) {
      actionIndex++;
      try {
        await runFacetSeed(page, seed);
      } catch (err) {
        console.error(`[seeder] FACET "${seed.query}" failed:`, err);
      }
      console.log(`[seeder] progress: ${actionIndex}/${totalActions}`);
      await page.waitForTimeout(THROTTLE_MS);
    }

    for (const q of buckets.rga) {
      actionIndex++;
      try {
        await runRGASeed(page, q);
      } catch (err) {
        console.error(`[seeder] RGA "${q}" failed:`, err);
      }
      console.log(`[seeder] progress: ${actionIndex}/${totalActions}`);
      await page.waitForTimeout(THROTTLE_MS);
    }

    for (const seed of buckets.art) {
      actionIndex++;
      try {
        await runArtClickSeed(page, seed);
      } catch (err) {
        console.error(
          `[seeder] ART "${seed.query} → /pokemon/${seed.targetSlug}" failed:`,
          err,
        );
      }
      console.log(`[seeder] progress: ${actionIndex}/${totalActions}`);
      await page.waitForTimeout(THROTTLE_MS);
    }
  }

  console.log(
    "\n[seeder] done. Coveo will incorporate these signals at the next ML model rebuild (typically nightly).",
  );
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
