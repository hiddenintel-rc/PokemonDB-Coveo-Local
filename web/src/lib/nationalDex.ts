/**
 * National Pokédex number from Coveo `result.raw`.
 *
 * **Indexing:** In Coveo Admin, add a field (recommended name: `pokemonnationalnumber`)
 * and map your Web scraper output to it — same lowercase convention as `pokemonbst`,
 * `pokemontype`, etc. (`docs/design-decisions.md` DD-7).
 *
 * **App:** Add that exact field name to `RAW_KEYS` (order = lookup priority) and to
 * `fieldsToInclude` in `web/src/coveo/search-instance.ts` plus
 * `DETAIL_FIELDS_TO_INCLUDE` in `web/src/coveo/fetch-pokemon-by-slug.ts` so hits
 * include the value in `raw`.
 *
 * We **never** infer national dex from search result list position (that produced
 * incorrect `#0001`, `#0002`, …).
 */

const RAW_KEYS = [
  "pokemonnationalnumber",
  "nationaldexnumber",
  "nationaldex",
  "nationalnumber",
  "pokedexnumber",
  "pokemondexnumber",
  "pokemonnumber",
] as const;

function parseNationalDexValue(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.trunc(v);
  const s = String(v).trim().replace(/^#/, "");
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 && n <= 9999 ? n : null;
}

export function nationalDexFromRaw(raw: Record<string, unknown>): number | null {
  for (const key of RAW_KEYS) {
    const n = parseNationalDexValue(raw[key]);
    if (n != null) return n;
  }
  return null;
}

export function formatNationalDex(n: number): string {
  return `#${String(n).padStart(4, "0")}`;
}

/** Strip indexed title suffix like " Pokédex: stats, …". */
export function cleanIndexedPokemonTitle(title: string): string {
  return title.replace(/\s+Pok[eé]dex:.*$/i, "").trim() || title;
}
