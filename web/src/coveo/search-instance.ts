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

/** Single “word” from the search box (letters, digits, hyphen); excludes Coveo operators. */
const PREFIX_WILDCARD_TOKEN = /^[a-zA-Z][a-zA-Z0-9-]{0,30}$/;

/**
 * Only **short** tokens get a trailing `*` so we do not rewrite full user intents
 * (e.g. `starter` → `starter*`), which breaks **query pipeline conditions** that use
 * exact match (`is starter`, featured results, etc.).
 *
 * Five characters covers common partial species prefixes (`garch`, `squi`, `pika`)
 * while leaving campaign keywords and most full names untouched.
 */
const PREFIX_WILDCARD_MAX_TOKEN_LENGTH = 5;

/**
 * Default Coveo keyword `q` matching does not treat `garch` as a prefix of the indexed
 * term `garchomp`. With `wildcards: true`, a trailing `*` on each **short** simple token
 * enables prefix expansion (see “Use wildcards in queries”, docs.coveo.com/en/1580).
 *
 * Coveo’s pipeline **partial match** feature mainly relaxes multi-keyword AND queries;
 * it often does not apply to single-token queries (docs.coveo.com/en/414), which is the
 * common Pokémon-name case. Mid-word typos (e.g. `dragn` vs `dragonite`) still need
 * Did you mean / pipeline tuning — prefix `*` cannot fix those.
 */
function augmentQueryForPrefixWildcards(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('"') || trimmed.startsWith("@")) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((token) => {
      if (token.length < 2) return token;
      if (token.length > PREFIX_WILDCARD_MAX_TOKEN_LENGTH) return token;
      if (token.endsWith("*") || token.endsWith("?")) return token;
      if (!PREFIX_WILDCARD_TOKEN.test(token)) return token;
      return `${token}*`;
    })
    .join(" ");
}

type SearchControllers = {
  searchBox: SearchBox;
  resultList: ResultList;
  typeFacet: Facet;
  generationFacet: Facet;
  abilityFacet: Facet;
  bstFacet: NumericFacet;
  /** Catch-rate numeric buckets (`pokemoncatchrate`); higher = easier. */
  catchRateFacet: NumericFacet;
  /** Game release group (red-blue, scarlet-violet, etc.). YAML Push field `pokemonrelease`. */
  releaseFacet: Facet;
  /** Experience growth curve (`pokemongrowthrate`). */
  growthRateFacet: Facet;
  /** Pokédex category label (`pokemonspecies`, e.g. Mouse, Seed). */
  speciesFacet: Facet;
  /** EV yield stat keys (`pokemonevyield`) — multi-value on index. */
  evYieldFacet: Facet;
  generatedAnswer: GeneratedAnswer;
};

/**
 * Name of the Push source created in Admin → Sources for the YAML-ingested
 * Pokémon dataset. Used in a `cq` (constant query) filter so the live app
 * only returns documents from this source — see `preprocessRequest` below.
 *
 * If the source is renamed in Coveo Admin, update this string. You may set this
 * to an empty string only if no other source indexes the same pokemondb.net
 * URIs (otherwise duplicate hits can appear).
 */
const COVEO_PUSH_SOURCE_NAME = "PokemonDB Reference (YAML)";

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

/**
 * Catch-rate tiers for `pokemoncatchrate` (integer 3–255 in main-series data).
 * **Higher** values mean **easier** catches (game mechanic). Same `[start, end)`
 * semantics as {@link BST_TIERS}. Top bucket uses `end: 256` to include 255.
 */
export const CATCH_RATE_TIERS = [
  { start: 200, end: 256, label: "Easiest", suffix: "200–255" },
  { start: 120, end: 200, label: "Very easy", suffix: "120–199" },
  { start: 70, end: 120, label: "Easy", suffix: "70–119" },
  { start: 35, end: 70, label: "Moderate", suffix: "35–69" },
  { start: 0, end: 35, label: "Tough", suffix: "3–34" },
] as const;

export type CatchRateTier = (typeof CATCH_RATE_TIERS)[number];

export function catchRateTierForRange(
  start: number,
  end: number,
): CatchRateTier | undefined {
  return CATCH_RATE_TIERS.find((t) => t.start === start && t.end === end);
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
        preprocessRequest: (request, clientOrigin) => {
          if (clientOrigin !== "searchApiFetch") return request;

          const req = request as {
            url?: string;
            body?: string | Record<string, unknown>;
            headers?: Record<string, string>;
          };
          const url = req.url ?? "";
          // Query suggestions are a separate endpoint that doesn't accept `cq`
          // and doesn't need wildcard rewrites — pass them through untouched.
          if (url.includes("querySuggest")) return request;

          let payload: Record<string, unknown>;
          if (typeof req.body === "string") {
            try {
              payload = JSON.parse(req.body) as Record<string, unknown>;
            } catch {
              return request;
            }
          } else if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
            payload = { ...(req.body as Record<string, unknown>) };
          } else {
            return request;
          }

          let mutated = false;

          // Constraint #1: scope every search to the YAML Push source. `cq`
          // (constant query) does not affect relevance ranking and does not
          // surface as a user-visible facet filter in analytics the same way
          // explicit facet selections do.
          if (COVEO_PUSH_SOURCE_NAME) {
            const sourceFilter = `@source=="${COVEO_PUSH_SOURCE_NAME}"`;
            const existingCq = typeof payload.cq === "string" ? payload.cq.trim() : "";
            payload.cq = existingCq ? `(${existingCq}) AND ${sourceFilter}` : sourceFilter;
            mutated = true;
          }

          // Constraint #2: prefix-wildcard expansion for short query tokens
          // (see augmentQueryForPrefixWildcards docs above).
          const q = payload.q;
          if (typeof q === "string" && q.trim()) {
            const newQ = augmentQueryForPrefixWildcards(q);
            if (newQ !== q) {
              payload.q = newQ;
              payload.wildcards = true;
              mutated = true;
            }
          }

          if (!mutated) return request;

          return {
            ...request,
            body: JSON.stringify(payload),
          };
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
          // The v2 fields (species/release/growth-rate/catch-rate/height/weight/form/ev-yield)
          // are added with the YAML Push source — map fields in Coveo Admin / your Push pipeline to match `fieldsToInclude` here.
          fieldsToInclude: [
            "pictureuri",
            "syspictureuri",
            "pokemontype",
            "pokemongeneration",
            "pokemonability",
            "pokemonbst",
            "pokemonnationalnumber",
            "picture_uri",
            "pokemon_generation",
            "pokemonspecies",
            "pokemonrelease",
            "pokemongrowthrate",
            "pokemoncatchrate",
            "pokemonheight",
            "pokemonweight",
            "pokemonform",
            "pokemonevyield",
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
        options: {
          facetId: "pokemonability",
          field: "pokemonability",
          numberOfValues: 50,
          injectionDepth: 5000,
        },
      }),
      releaseFacet: buildFacet(e, {
        options: { facetId: "pokemonrelease", field: "pokemonrelease", numberOfValues: 30 },
      }),
      growthRateFacet: buildFacet(e, {
        options: {
          facetId: "pokemongrowthrate",
          field: "pokemongrowthrate",
          numberOfValues: 20,
        },
      }),
      speciesFacet: buildFacet(e, {
        options: {
          facetId: "pokemonspecies",
          field: "pokemonspecies",
          numberOfValues: 50,
          injectionDepth: 5000,
        },
      }),
      evYieldFacet: buildFacet(e, {
        options: {
          facetId: "pokemonevyield",
          field: "pokemonevyield",
          numberOfValues: 12,
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
      // Catch rate (Integer 32 in Admin). Higher = easier; see CATCH_RATE_TIERS.
      catchRateFacet: buildNumericFacet(e, {
        options: {
          facetId: "pokemoncatchrate",
          field: "pokemoncatchrate",
          generateAutomaticRanges: false,
          currentValues: CATCH_RATE_TIERS.map(({ start, end }) => ({
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
          "pokemonspecies",
          "pokemonrelease",
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
