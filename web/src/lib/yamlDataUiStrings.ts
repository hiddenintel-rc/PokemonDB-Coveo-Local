import type { YamlDataLocale } from "@/coveo/yaml-data-locale";
import { BST_TIERS } from "@/coveo/search-instance";

/** Coveo BST tier label (English) → Spanish badge text on detail cards. */
const BST_TIER_LABEL_ES: Record<string, string> = {
  Frail: "Frágil",
  Average: "Promedio",
  Strong: "Fuerte",
  "Very strong": "Muy fuerte",
  Legendary: "Legendario",
};

export function bstTierLabelForLocale(
  bst: number,
  locale: YamlDataLocale,
): string | undefined {
  const tier = BST_TIERS.find((t) => bst >= t.start && bst < t.end);
  if (!tier) return undefined;
  if (locale === "es") return BST_TIER_LABEL_ES[tier.label] ?? tier.label;
  return tier.label;
}

export type YamlUiStrings = {
  chromeTagline: string;
  pageTitleSearch: string;
  searchPlaceholder: string;
  searchButton: string;
  searchAriaLabel: string;
  suggestionsLoading: string;
  suggestionsEmptyHint: string;
  resultsLoading: string;
  resultsFailed: string;
  resultsCount: (n: number) => string;
  cardNoImage: string;
  cardBstAria: (bst: number) => string;
  cardBstPrefix: string;
  cardViewDetailsAria: (name: string) => string;
  detailBackToSearch: string;
  detailTypes: string;
  detailGeneration: string;
  detailAbilities: string;
  detailProfile: string;
  detailStats: string;
  detailStatTotal: string;
  detailStatHp: string;
  detailStatAttack: string;
  detailStatDefense: string;
  detailStatSpAtk: string;
  detailStatSpDef: string;
  detailStatSpeed: string;
  detailProfileSize: string;
  detailProfileHeight: string;
  detailProfileWeight: string;
  detailProfileCatchRate: string;
  detailProfileGrowthRate: string;
  detailProfileDebut: string;
  detailProfileEvYield: string;
  detailSpeciesMeta: (species: string) => string;
  detailMetaBstAria: (bst: number) => string;
  detailMetaBstPrefix: string;
  detailNoImage: string;
  detailFooterIndexed: string;
  detailViewOnSite: string;
  detailSpriteAsideAria: string;
  detailSkeletonTitle: string;
  notFoundPageTitle: string;
  notFoundHeading: string;
  notFoundIntroBeforeSlug: string;
  notFoundIntroAfterSlug: string;
  notFoundBody2: string;
  notFoundCta: string;
  errorPageTitle: string;
  errorBody: string;
};

const UI: Record<YamlDataLocale, YamlUiStrings> = {
  en: {
    chromeTagline: "Coveo Pokédex",
    pageTitleSearch: "Pokémon search",
    searchPlaceholder: "Search Pokémon…",
    searchButton: "Search",
    searchAriaLabel: "Search",
    suggestionsLoading: "Loading suggestions…",
    suggestionsEmptyHint:
      "No query suggestions yet. The Coveo Query Suggestions model often returns nothing while status is Limited, until enough search analytics have been ingested.",
    resultsLoading: "Loading…",
    resultsFailed: "No results loaded (search failed).",
    resultsCount: (n) => `${n} result${n === 1 ? "" : "s"}`,
    cardNoImage: "No image",
    cardBstAria: (bst) => `Base Stat Total ${bst}`,
    cardBstPrefix: "BST",
    cardViewDetailsAria: (name) => `View details for ${name}`,
    detailBackToSearch: "Back to search",
    detailTypes: "Types",
    detailGeneration: "Generation",
    detailAbilities: "Abilities",
    detailProfile: "Profile",
    detailStats: "Stats",
    detailStatTotal: "Total",
    detailStatHp: "HP",
    detailStatAttack: "Attack",
    detailStatDefense: "Defense",
    detailStatSpAtk: "Sp. Atk",
    detailStatSpDef: "Sp. Def",
    detailStatSpeed: "Speed",
    detailProfileSize: "Size",
    detailProfileHeight: "Height",
    detailProfileWeight: "Weight",
    detailProfileCatchRate: "Catch rate",
    detailProfileGrowthRate: "Growth rate",
    detailProfileDebut: "Debut",
    detailProfileEvYield: "EV yield",
    detailSpeciesMeta: (species) => `${species} Pokémon`,
    detailMetaBstAria: (bst) => `Base Stat Total ${bst}`,
    detailMetaBstPrefix: "BST",
    detailNoImage: "No image",
    detailFooterIndexed:
      "Indexed in Coveo from YAML reference data (pokemondb.net species URLs)",
    detailViewOnSite: "View on pokemondb.net",
    detailSpriteAsideAria: "Local sprite assets",
    detailSkeletonTitle: "Pokémon",
    notFoundPageTitle: "Pokémon not found",
    notFoundHeading: "No matching species",
    notFoundIntroBeforeSlug: "No indexed Pokémon matched the slug ",
    notFoundIntroAfterSlug: ".",
    notFoundBody2: "Try a different name from the search results.",
    notFoundCta: "Back to search",
    errorPageTitle: "Could not load details",
    errorBody: "Could not load Pokémon details",
  },
  es: {
    chromeTagline: "Pokédex Coveo",
    pageTitleSearch: "Búsqueda Pokémon",
    searchPlaceholder: "Buscar Pokémon…",
    searchButton: "Buscar",
    searchAriaLabel: "Buscar",
    suggestionsLoading: "Cargando sugerencias…",
    suggestionsEmptyHint:
      "Aún no hay sugerencias. El modelo de sugerencias de Coveo a veces no devuelve nada mientras el estado sea «Limited», hasta acumular analíticas de búsqueda.",
    resultsLoading: "Cargando…",
    resultsFailed: "No se pudieron cargar resultados (error de búsqueda).",
    resultsCount: (n) => (n === 1 ? "1 resultado" : `${n} resultados`),
    cardNoImage: "Sin imagen",
    cardBstAria: (bst) => `Total estadísticas base ${bst}`,
    cardBstPrefix: "TSB",
    cardViewDetailsAria: (name) => `Ver ficha de ${name}`,
    detailBackToSearch: "Volver a la búsqueda",
    detailTypes: "Tipos",
    detailGeneration: "Generación",
    detailAbilities: "Habilidades",
    detailProfile: "Perfil",
    detailStats: "Estadísticas",
    detailStatTotal: "Total",
    detailStatHp: "PS",
    detailStatAttack: "Ataque",
    detailStatDefense: "Defensa",
    detailStatSpAtk: "At. Esp.",
    detailStatSpDef: "Def. Esp.",
    detailStatSpeed: "Velocidad",
    detailProfileSize: "Tamaño",
    detailProfileHeight: "Altura",
    detailProfileWeight: "Peso",
    detailProfileCatchRate: "Ratio de captura",
    detailProfileGrowthRate: "Curva de crecimiento",
    detailProfileDebut: "Estreno",
    detailProfileEvYield: "Esfuerzo",
    detailSpeciesMeta: (species) => species,
    detailMetaBstAria: (bst) => `Total estadísticas base ${bst}`,
    detailMetaBstPrefix: "TSB",
    detailNoImage: "Sin imagen",
    detailFooterIndexed:
      "Indexado en Coveo desde datos YAML de referencia (URLs de especies en pokemondb.net)",
    detailViewOnSite: "Ver en pokemondb.net",
    detailSpriteAsideAria: "Sprites locales",
    detailSkeletonTitle: "Pokémon",
    notFoundPageTitle: "Pokémon no encontrado",
    notFoundHeading: "Sin especies coincidentes",
    notFoundIntroBeforeSlug: "Ningún Pokémon indexado coincide con el slug ",
    notFoundIntroAfterSlug: ".",
    notFoundBody2: "Prueba con otro nombre desde los resultados de búsqueda.",
    notFoundCta: "Volver a la búsqueda",
    errorPageTitle: "No se pudieron cargar los datos",
    errorBody: "No se pudieron cargar los datos del Pokémon",
  },
};

export function yamlDataUi(locale: YamlDataLocale): YamlUiStrings {
  return UI[locale];
}
