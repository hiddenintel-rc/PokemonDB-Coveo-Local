/**
 * Shared display formatters for Coveo facet values sourced from the YAML Push
 * index (`pokemonrelease`, `pokemongrowthrate`, `pokemonevyield`).
 */

/** Manual overrides where hyphen-splitting would read poorly in the UI. */
const RELEASE_PRETTY: Record<string, string> = {
  "lets-go-pikachu-eevee": "Let's Go, Pikachu & Eevee",
  "legends-arceus": "Legends: Arceus",
  "legends-z-a": "Legends: Z-A",
  "scarlet-violet": "Scarlet & Violet",
  "sword-shield": "Sword & Shield",
  "sun-moon": "Sun & Moon",
  "x-y": "X & Y",
  "black-white": "Black & White",
  "black-2-white-2": "Black 2 & White 2",
  "ruby-sapphire": "Ruby & Sapphire",
  "omega-ruby-alpha-sapphire": "Omega Ruby & Alpha Sapphire",
  "diamond-pearl": "Diamond & Pearl",
  "brilliant-diamond-shining-pearl": "Brilliant Diamond & Shining Pearl",
  "gold-silver": "Gold & Silver",
  "red-blue": "Red & Blue",
  "firered-leafgreen": "FireRed & LeafGreen",
  "heartgold-soulsilver": "HeartGold & SoulSilver",
};

/**
 * Pretty-print `pokemonrelease` slugs (`red-blue`, `scarlet-violet`) for facet UI.
 */
export function formatReleaseLabel(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (!k) return raw;
  if (RELEASE_PRETTY[k]) return RELEASE_PRETTY[k];
  const tokens = k.split("-").map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  return tokens.length <= 1 ? tokens.join("") : tokens.join(" & ");
}

/** Pretty-print `pokemongrowthrate` (`medium slow` → `Medium slow`). */
export function formatGrowthRateLabel(raw: string): string {
  if (!raw) return raw;
  return raw
    .split("-")
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
}

const EV_YIELD_STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  spatk: "Sp. Atk",
  spdef: "Sp. Def",
  speed: "Speed",
};

/** Map YAML / Coveo `pokemonevyield` facet keys to short display labels. */
export function formatEvYieldStatLabel(key: string): string {
  const k = key.trim().toLowerCase();
  return EV_YIELD_STAT_LABELS[k] ?? key;
}
