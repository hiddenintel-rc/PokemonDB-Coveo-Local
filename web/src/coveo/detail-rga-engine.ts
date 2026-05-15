"use client";

import {
  buildGeneratedAnswer,
  buildSearchEngine,
  loadQueryActions,
  loadSearchActions,
  loadSearchAnalyticsActions,
  type GeneratedAnswer,
  type SearchEngine,
} from "@coveo/headless";
import {
  getSearchEngineConfiguration,
  RGA_CITATION_FIELDS_TO_INCLUDE,
} from "@/coveo/search-instance";

/**
 * Second SearchEngine dedicated to detail-page RGA. Programmatic `executeSearch`
 * here does not touch the home `getSearchEngine()` state (query, facets, results).
 */
let detailRgaEngine: SearchEngine | null = null;

/** `buildGeneratedAnswer` controller bound to {@link getDetailRgaEngine}. */
let detailGeneratedAnswer: GeneratedAnswer | null = null;

export function getDetailRgaEngine(): SearchEngine {
  if (!detailRgaEngine) {
    detailRgaEngine = buildSearchEngine({
      configuration: getSearchEngineConfiguration(),
    });
  }
  return detailRgaEngine;
}

export function getDetailGeneratedAnswer(): GeneratedAnswer {
  const e = getDetailRgaEngine();
  if (!detailGeneratedAnswer) {
    detailGeneratedAnswer = buildGeneratedAnswer(e, {
      fieldsToIncludeInCitations: [...RGA_CITATION_FIELDS_TO_INCLUDE],
    }) as GeneratedAnswer;
  }
  return detailGeneratedAnswer;
}

/**
 * Runs a keyword search on the isolated engine with **searchbox submit** analytics,
 * so RGA sees the same pipeline context as a user-typed query and UA receives a
 * proper search event (legacy mode — see `getSearchEngineConfiguration`).
 */
export function runDetailRgaNlSearch(nlQuery: string): void {
  const engine = getDetailRgaEngine();
  const q = nlQuery.trim();
  if (!q) return;

  const { updateQuery } = loadQueryActions(engine);
  const { executeSearch } = loadSearchActions(engine);
  const { logSearchboxSubmit } = loadSearchAnalyticsActions(engine);

  engine.dispatch(updateQuery({ q }));
  engine.dispatch(executeSearch(logSearchboxSubmit()));
}
