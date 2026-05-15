/**
 * Which YAML Push source backs the UI: English (`PokemonDB Reference (YAML)`)
 * or Spanish (`PokemonDB Reference (YAML) — ES`). Drives the `@source` part of
 * `cq` in {@link ./search-instance.ts} and detail fetches in
 * {@link ./fetch-pokemon-by-slug.ts}.
 */

export const YAML_PUSH_SOURCE_EN = "PokemonDB Reference (YAML)";

/** Must match Coveo Admin source display name exactly (Unicode em dash). */
export const YAML_PUSH_SOURCE_ES = "PokemonDB Reference (YAML) — ES";

const STORAGE_KEY = "pokemonDbYamlDataLocale";

export type YamlDataLocale = "en" | "es";

/** Fired on `window` after {@link setYamlDataLocale} updates storage. */
export const YAML_DATA_LOCALE_CHANGE_EVENT = "pokemon:yaml-data-locale-change";

let cached: YamlDataLocale | null = null;

function readStorage(): YamlDataLocale {
  if (typeof window === "undefined") return "en";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export function getYamlDataLocale(): YamlDataLocale {
  if (cached == null) cached = readStorage();
  return cached;
}

export function setYamlDataLocale(locale: YamlDataLocale): void {
  cached = locale;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* private mode / quota */
    }
    window.dispatchEvent(
      new CustomEvent(YAML_DATA_LOCALE_CHANGE_EVENT, { detail: { locale } }),
    );
  }
}

/** Coveo `@source=="…"` display name for the active YAML dataset. */
export function getYamlPushSourceDisplayName(): string {
  return getYamlDataLocale() === "es" ? YAML_PUSH_SOURCE_ES : YAML_PUSH_SOURCE_EN;
}
