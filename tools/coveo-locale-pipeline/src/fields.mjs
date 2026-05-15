/**
 * Coveo `fieldsToInclude` for YAML Push exports.
 * Keep in sync with `web/src/coveo/search-instance.ts` (result list) and
 * `web/src/coveo/fetch-pokemon-by-slug.ts` (`DETAIL_FIELDS_TO_INCLUDE`).
 */
export const YAML_PUSH_SOURCE_DISPLAY_NAME = "PokemonDB Reference (YAML)";

export const YAML_EXPORT_FIELDS_TO_INCLUDE = [
  "pictureuri",
  "syspictureuri",
  "pokemontype",
  "pokemongeneration",
  "pokemonability",
  "pokemonbst",
  "pokemonnationalnumber",
  "pokemonhp",
  "pokemonattack",
  "pokemondefense",
  "pokemonspatk",
  "pokemonspdef",
  "pokemonspeed",
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
];
