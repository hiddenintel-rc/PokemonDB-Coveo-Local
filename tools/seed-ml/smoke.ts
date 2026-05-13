/**
 * End-to-end smoke test for the live Pokemon Search app.
 *
 * Drives a real browser against a running Next.js dev (or production) server and
 * asserts the core user-visible flow works:
 *
 *   1. Home loads, search input is mounted, env-missing banner is NOT visible.
 *   2. `executeFirstSearch` returns at least one result (proves NEXT_PUBLIC_COVEO_*
 *      are set, the Coveo Search API is reachable, and the result list renders).
 *   3. The Type facet is populated (proves field mapping + buildFacet wiring).
 *   4. Clicking the first result navigates to /pokemon/[slug] and renders the
 *      detail article (proves the InteractiveResult Link + the direct fetch
 *      path in `fetch-pokemon-by-slug.ts` both work).
 *   5. No React duplicate-key warning fires during the flow (regression guard
 *      for the multi-form Pokémon dedupe fix).
 *   6. No Coveo "Analytics Mode: Next" warning fires (regression guard for the
 *      `analyticsMode: 'legacy'` pin — DD-15).
 *
 * Usage (from `tools/seed-ml/`, after `npm install` + `npm run setup`):
 *
 *   npm run smoke                          # headless against http://localhost:3000
 *   npm run smoke:headed                   # watch it run
 *   npm run smoke -- --url http://localhost:3001
 *
 * Start the app first: `cd web && npm run dev` (with `.env.local` populated).
 *
 * Exit code: 0 on full pass, 1 if any assertion or unexpected error occurs.
 */

import { chromium, type ConsoleMessage, type Page } from "playwright";

const args = process.argv.slice(2);
const hasFlag = (flag: string): boolean => args.includes(flag);
const getOpt = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i >= 0 && typeof args[i + 1] === "string" ? args[i + 1] : fallback;
};

const URL_TARGET = getOpt("--url", "http://localhost:3000");
const HEADED = hasFlag("--headed");
const NAV_TIMEOUT_MS = Math.max(
  1000,
  Number.parseInt(getOpt("--timeout", "15000"), 10) || 15000,
);

type AssertionResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const results: AssertionResult[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  const suffix = detail ? `  (${detail})` : "";
  // eslint-disable-next-line no-console
  console.log(`[smoke] ${tag}  ${name}${suffix}`);
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[smoke] target URL : ${URL_TARGET}`);
  // eslint-disable-next-line no-console
  console.log(`[smoke] mode       : ${HEADED ? "headed" : "headless"}`);
  // eslint-disable-next-line no-console
  console.log(`[smoke] nav timeout: ${NAV_TIMEOUT_MS}ms`);

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Capture every console message that matters. We intentionally watch for two
  // specific regressions — duplicate React keys and Coveo's legacy/Next warning
  // — instead of failing on any warning, because Coveo and Next.js dev mode
  // produce other benign info-level chatter.
  const duplicateKeyWarnings: string[] = [];
  const analyticsModeWarnings: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    const text = msg.text();
    if (
      msg.type() === "warning" &&
      text.includes("Encountered two children with the same key")
    ) {
      duplicateKeyWarnings.push(text);
    }
    if (
      text.includes("Analytics Mode") &&
      text.includes('"Next"')
    ) {
      analyticsModeWarnings.push(text);
    }
  });

  try {
    await assertHomeLoads(page);
    await assertInitialResultsReturn(page);
    await assertTypeFacetPopulated(page);
    await assertDetailNavigation(page);

    record(
      "no React duplicate-key warnings during flow",
      duplicateKeyWarnings.length === 0,
      duplicateKeyWarnings.length === 0
        ? undefined
        : `saw ${duplicateKeyWarnings.length}: ${duplicateKeyWarnings.slice(0, 2).join(" | ")}`,
    );
    record(
      "no Coveo Analytics Mode \"Next\" warnings during flow",
      analyticsModeWarnings.length === 0,
      analyticsModeWarnings.length === 0
        ? undefined
        : `saw ${analyticsModeWarnings.length}: ${analyticsModeWarnings[0]}`,
    );
  } finally {
    await browser.close();
  }

  const failures = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(
    `\n[smoke] summary: ${results.length - failures.length}/${results.length} assertions passed`,
  );
  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[smoke] failed assertions:\n  - ${failures.map((f) => `${f.name}${f.detail ? ` (${f.detail})` : ""}`).join("\n  - ")}`,
    );
    process.exit(1);
  }
}

async function assertHomeLoads(page: Page): Promise<void> {
  try {
    await page.goto(URL_TARGET, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
  } catch (err) {
    record(
      "home loads",
      false,
      `navigation failed — is "npm run dev" running in web/? (${(err as Error).message})`,
    );
    throw err;
  }

  const searchInput = page.locator('input[type="search"][role="combobox"]');
  const visible = await searchInput
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  record("home loads (search input mounted)", visible);

  // The env-missing banner is the SearchInterface fallback when org/key are
  // absent. If it's on screen, every other assertion would fail anyway with
  // an unhelpful timeout — surface the real reason now.
  const envMissing = await page
    .getByText("Coveo environment variables missing", { exact: false })
    .isVisible()
    .catch(() => false);
  record(
    "Coveo env vars present (no env-missing banner)",
    !envMissing,
    envMissing
      ? "set NEXT_PUBLIC_COVEO_ORG_ID and NEXT_PUBLIC_COVEO_API_KEY in web/.env.local"
      : undefined,
  );
  if (envMissing) {
    throw new Error("Env-missing banner is visible; further assertions cannot run.");
  }
}

async function assertInitialResultsReturn(page: Page): Promise<void> {
  // Don't rely on the "N results" text — `SearchInterface` renders the count
  // immediately as "0 results" on first mount (before `executeFirstSearch`
  // resolves), so a naive text wait succeeds against a transient empty state.
  // Poll the actual result-card DOM instead and wait for at least one card.
  const cardLink = page.locator('a[href^="/pokemon/"]').first();
  const ok = await cardLink
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    record(
      "initial search returns results",
      false,
      "no result card appeared within 10s — check Coveo connectivity and that the source has indexed content",
    );
    return;
  }
  const cardCount = await page.locator('a[href^="/pokemon/"]').count();
  record(
    "initial search returns results",
    cardCount > 0,
    `${cardCount} result card${cardCount === 1 ? "" : "s"}`,
  );
}

async function assertTypeFacetPopulated(page: Page): Promise<void> {
  const panel = page.locator('[data-product-filter="pokemon-type"]');
  const visible = await panel
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    record("type facet panel renders", false, "panel never became visible");
    return;
  }

  // <details> needs to be opened before option rows are reachable in the
  // accessibility tree (they're not visually hidden — just collapsed).
  const open = await panel.evaluate((el) =>
    el instanceof HTMLDetailsElement ? el.open : true,
  );
  if (!open) {
    await panel.locator("summary").click();
  }

  // Same race as the result count: facet values are empty until the first
  // search returns. Wait for the first option to appear rather than counting
  // immediately. Timeout is generous because facet population depends on the
  // full search round-trip.
  const firstOption = panel.locator("[data-filter-option]").first();
  const optionReady = await firstOption
    .waitFor({ state: "attached", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!optionReady) {
    record(
      "type facet has at least one option",
      false,
      "no option rows appeared within 10s",
    );
    return;
  }
  const optionCount = await panel.locator("[data-filter-option]").count();
  record(
    "type facet has at least one option",
    optionCount > 0,
    `${optionCount} options rendered`,
  );
}

async function assertDetailNavigation(page: Page): Promise<void> {
  // The first PokemonCard <Link> on the page. We deliberately read its href
  // before clicking so we can assert the URL pattern even before navigation.
  const firstCardLink = page.locator('a[href^="/pokemon/"]').first();
  const hasFirstLink = await firstCardLink
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!hasFirstLink) {
    record("result card links to /pokemon/[slug]", false, "no card link found");
    return;
  }

  const href = (await firstCardLink.getAttribute("href")) ?? "";
  const linkOk = /^\/pokemon\/[a-z0-9-]+$/.test(href);
  record(
    "result card links to /pokemon/[slug]",
    linkOk,
    linkOk ? href : `unexpected href: ${href}`,
  );
  if (!linkOk) return;

  await firstCardLink.click();
  await page.waitForURL(`**${href}`, { timeout: NAV_TIMEOUT_MS }).catch(() => undefined);

  // The detail view renders either the skeleton, found, not-found, or error
  // state. Wait until the skeleton is gone and the found-state article shows
  // up. If we get not-found or error instead, treat it as a smoke failure
  // (every indexed result should resolve to a found detail).
  const foundArticle = page.locator('[data-region="pokemon-detail"]');
  const notFound = page.locator('[data-region="pokemon-not-found"]');

  const result = await Promise.race([
    foundArticle
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => "found" as const),
    notFound
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => "notfound" as const),
  ]).catch(() => "timeout" as const);

  record(
    "detail page renders found state",
    result === "found",
    result === "found" ? href : `state: ${result}`,
  );

  if (result === "found") {
    const heading = await page.locator("article h1").first().textContent();
    record(
      "detail page shows a Pokémon name",
      Boolean(heading && heading.trim().length > 0),
      heading?.trim() || undefined,
    );
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[smoke] unexpected error:", err);
  process.exit(1);
});
