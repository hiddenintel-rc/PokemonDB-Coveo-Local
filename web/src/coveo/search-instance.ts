"use client";

import {
  buildFacet,
  buildGeneratedAnswer,
  buildNumericFacet,
  buildResultList,
  buildSearchBox,
  buildSearchEngine,
  type Facet,
  type GeneratedAnswer,
  type NumericFacet,
  type ResultList,
  type SearchBox,
  type SearchEngine,
} from "@coveo/headless";

let engine: SearchEngine | null = null;

type SearchControllers = {
  searchBox: SearchBox;
  resultList: ResultList;
  typeFacet: Facet;
  generationFacet: Facet;
  abilityFacet: Facet;
  bstFacet: NumericFacet;
  generatedAnswer: GeneratedAnswer;
};

/**
 * Community-recognized Base Stat Total tiers.
 * Single source of truth for both the numeric facet ranges and the UI labels —
 * `BST_TIERS[i].label` is what renders in the sidebar; the same `{start, end}`
 * pair seeds `currentValues` on `buildNumericFacet` below.
 *
 * Ranges follow Coveo's `endInclusive: false` semantics: `[start, end)`.
 * `end: 1000` for the top tier safely covers the ~720 ceiling without baking
 * an arbitrary upper limit into the index.
 *
 * The bucketing is presentation logic, not data — boundaries can be changed by
 * editing this array, no re-index needed (raw `pokemonbst` integer stays in
 * the index for sorting / ranking expressions / future per-stat facets).
 */
export const BST_TIERS = [
  { start: 0, end: 300, label: "Frail", suffix: "<300" },
  { start: 300, end: 450, label: "Average", suffix: "300–449" },
  { start: 450, end: 520, label: "Strong", suffix: "450–519" },
  { start: 520, end: 580, label: "Very strong", suffix: "520–579" },
  { start: 580, end: 1000, label: "Legendary", suffix: "580+" },
] as const;

export type BstTier = (typeof BST_TIERS)[number];

/** Resolve a NumericFacetValue back to its labeled tier by matching boundaries. */
export function bstTierForRange(
  start: number,
  end: number,
): BstTier | undefined {
  return BST_TIERS.find((t) => t.start === start && t.end === end);
}

let controllers: SearchControllers | null = null;

export function getSearchEngine(): SearchEngine {
  if (!engine) {
    engine = buildSearchEngine({
      configuration: {
        organizationId: process.env.NEXT_PUBLIC_COVEO_ORG_ID ?? "",
        accessToken: process.env.NEXT_PUBLIC_COVEO_API_KEY ?? "",
        // Headless v3 ships with `analyticsMode: 'next'` (Event Protocol) by default, which Coveo
        // currently only fully supports for **Commerce** orgs. For Search / Service / Website /
        // Workplace implementations (this project), Coveo's own v2→v3 guide instructs setting
        // `analyticsMode: 'legacy'` so events flow through the classic Coveo UA endpoint that
        // `pokemon_QS`, `pokemon_RGA`, and `pokemon_ART` already consume — and so Headless stops
        // emitting the noisy "this mode is not available for Coveo for Service features" warning.
        analytics: { analyticsMode: "legacy" },
        search: {
          // Coveo Search hub: analytics + query-pipeline routing label (not your Web source name).
          // If the API key *enforces* a hub, this must match that value (e.g. AdminConsole).
          // If the key leaves Search hub unset, pick a stable app-specific string (see `.env.example`).
          searchHub:
            process.env.NEXT_PUBLIC_COVEO_SEARCH_HUB ?? "PokemonSearch",
        },
      },
    });
  }
  return engine;
}

export function getSearchControllers(): SearchControllers {
  if (!controllers) {
    const e = getSearchEngine();
    controllers = {
      searchBox: buildSearchBox(e, {
        options: {
          // Enables Coveo Query Suggestions (QS model `pokemon_QS` associated to the default
          // pipeline). Headless emits `searchQuerySuggest` analytics on selection so the model
          // also learns from real usage. `0` disables suggestions entirely.
          numberOfSuggestions: 8,
        },
      }),
      resultList: buildResultList(e, {
        options: {
          // Custom fields are not part of the default search hit payload; without this,
          // result.raw omits e.g. pictureuri even when populated (Content Browser still shows them).
          fieldsToInclude: [
            "pictureuri",
            "syspictureuri",
            "pokemontype",
            "pokemongeneration",
            "pokemonability",
            "pokemonbst",
            "picture_uri",
            "pokemon_generation",
          ],
        },
      }),
      typeFacet: buildFacet(e, {
        options: { field: "pokemontype", numberOfValues: 25 },
      }),
      generationFacet: buildFacet(e, {
        options: { field: "pokemongeneration", numberOfValues: 15 },
      }),
      abilityFacet: buildFacet(e, {
        // Many distinct abilities across the dex; start at 50 and tune after re-index.
        options: {
          facetId: "pokemonability",
          field: "pokemonability",
          numberOfValues: 50,
          // Large dex: ensure facet scan depth is not the bottleneck (default 1000).
          injectionDepth: 5000,
        },
      }),
      // BST (Base Stat Total) numeric facet — fixed, labeled tiers (see BST_TIERS).
      // `pokemonbst` must be a numeric field in Coveo Admin (Integer 32 in trial orgs,
      // or Long in higher tiers) — String breaks numeric range queries silently. If the
      // field is missing or empty across the index, Coveo still returns the requested
      // ranges with `numberOfResults: 0` — no error, panel renders but selections yield
      // no matches.
      bstFacet: buildNumericFacet(e, {
        options: {
          facetId: "pokemonbst",
          field: "pokemonbst",
          generateAutomaticRanges: false,
          currentValues: BST_TIERS.map(({ start, end }) => ({
            start,
            end,
            endInclusive: false,
            state: "idle",
          })),
        },
      }),
      // Coveo Relevance Generative Answering (RGA). Gracefully no-ops if the model is not
      // associated to the active pipeline or the org doesn't have RGA enabled — the panel
      // simply renders nothing in that case.
      // `fieldsToIncludeInCitations` carries our custom fields onto each citation so the
      // UI can render type / generation / image alongside the cited species name.
      generatedAnswer: buildGeneratedAnswer(e, {
        fieldsToIncludeInCitations: [
          "pictureuri",
          "syspictureuri",
          "pokemontype",
          "pokemongeneration",
          "pokemonability",
        ],
      }) as GeneratedAnswer,
    };
  }
  return controllers;
}

export function coveoConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_COVEO_ORG_ID &&
      process.env.NEXT_PUBLIC_COVEO_API_KEY,
  );
}
