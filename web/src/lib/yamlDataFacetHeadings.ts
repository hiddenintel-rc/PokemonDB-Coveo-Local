import type { YamlDataLocale } from "@/coveo/yaml-data-locale";

/** Keys for facet filter panel headings — keep in sync with `SearchInterface`. */
export type YamlFacetHeadingKey =
  | "pokemonType"
  | "generation"
  | "ability"
  | "bst"
  | "catchRate"
  | "release"
  | "species"
  | "growthRate"
  | "evYield";

const HEADINGS: Record<YamlDataLocale, Record<YamlFacetHeadingKey, string>> = {
  en: {
    pokemonType: "Pokémon type",
    generation: "Generation",
    ability: "Ability",
    bst: "Base stat total",
    catchRate: "Catch rate (higher = easier)",
    release: "Game release",
    species: "Species category",
    growthRate: "Growth rate",
    evYield: "EV yield",
  },
  es: {
    pokemonType: "Tipo",
    generation: "Generación",
    ability: "Habilidad",
    bst: "Total estadísticas base",
    catchRate: "Ratio de captura (más alto = más fácil)",
    release: "Lanzamiento del juego",
    species: "Categoría",
    growthRate: "Curva de crecimiento",
    evYield: "Esfuerzo",
  },
};

export function yamlFacetHeading(
  key: YamlFacetHeadingKey,
  locale: YamlDataLocale,
): string {
  return HEADINGS[locale][key];
}
