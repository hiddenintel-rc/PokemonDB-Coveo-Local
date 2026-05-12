/**
 * Coveo Search API helper for the Pokémon detail route.
 *
 * Why a direct fetch (not the Headless engine):
 *   - The detail page is a one-off lookup; we don't want it to overwrite the search
 *     interface's engine state (current query, facets, results list). Using
 *     `engine.dispatch(executeSearch(...))` would clobber that state.
 *   - No analytics for this call — the user already fired a `documentClick` on the
 *     result card. The detail-page fetch is pure retrieval, not a new search.
 *   - Same credentials as the engine (NEXT_PUBLIC_COVEO_*), already exposed to the
 *     client, so no auth path change.
 *
 * Returns the first hit whose `uri` matches `pokemondb.net/pokedex/{slug}`
 * (with or without a trailing slash), or `null` if there are no hits.
 */

/** Subset of fields we render on the detail page. */
export type PokemonDetailHit = {
  uri: string;
  clickUri: string;
  title: string;
  raw: Record<string, unknown>;
};

const COVEO_SEARCH_ENDPOINT =
  "https://platform.cloud.coveo.com/rest/search/v2";

/** All custom fields rendered on the detail page — includes BST + six individual stat fields for the stats section. */
const DETAIL_FIELDS_TO_INCLUDE = [
  "pictureuri",
  "syspictureuri",
  "pokemontype",
  "pokemongeneration",
  "pokemonability",
  "pokemonbst",
  "pokemonhp",
  "pokemonattack",
  "pokemondefense",
  "pokemonspatk",
  "pokemonspdef",
  "pokemonspeed",
  "picture_uri",
  "pokemon_generation",
];

/** Pull the URL slug from a Coveo result's `clickUri` (last non-empty path segment). */
export function slugFromClickUri(clickUri: string | undefined): string | null {
  if (!clickUri) return null;
  try {
    const u = new URL(clickUri);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last ? last.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Normalize a user-provided slug (URL segment) to the form we query Coveo with. */
export function normalizeSlug(slug: string | undefined): string | null {
  if (!slug) return null;
  const trimmed = decodeURIComponent(slug).trim().toLowerCase();
  // Allow letters, digits, and hyphens (pokemondb slugs e.g. `mr-mime`, `ho-oh`).
  if (!/^[a-z0-9-]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function fetchPokemonBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<PokemonDetailHit | null> {
  const orgId = process.env.NEXT_PUBLIC_COVEO_ORG_ID ?? "";
  const apiKey = process.env.NEXT_PUBLIC_COVEO_API_KEY ?? "";
  const searchHub = process.env.NEXT_PUBLIC_COVEO_SEARCH_HUB ?? "PokemonSearch";

  if (!orgId || !apiKey) {
    throw new Error(
      "Coveo credentials missing — set NEXT_PUBLIC_COVEO_ORG_ID and NEXT_PUBLIC_COVEO_API_KEY.",
    );
  }

  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  // Match either trailing-slash variant in a single query. Coveo's @field==
  // accepts a parenthesized list of values for OR-equality.
  const candidates = [
    `https://pokemondb.net/pokedex/${normalized}`,
    `https://pokemondb.net/pokedex/${normalized}/`,
  ]
    .map((u) => `"${u}"`)
    .join(",");

  const body = {
    organizationId: orgId,
    searchHub,
    aq: `@uri==(${candidates})`,
    q: "",
    numberOfResults: 1,
    fieldsToInclude: DETAIL_FIELDS_TO_INCLUDE,
    // Skip analytics for this retrieval — the detail page is not a user search.
    analytics: { enabled: false },
  };

  const response = await fetch(
    `${COVEO_SEARCH_ENDPOINT}?organizationId=${encodeURIComponent(orgId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Coveo search returned ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    results?: Array<{
      uri?: string;
      clickUri?: string;
      title?: string;
      raw?: Record<string, unknown>;
    }>;
  };

  const first = json.results?.[0];
  if (!first || !first.uri) return null;

  return {
    uri: first.uri,
    clickUri: first.clickUri ?? first.uri,
    title: first.title ?? normalized,
    raw: first.raw ?? {},
  };
}
