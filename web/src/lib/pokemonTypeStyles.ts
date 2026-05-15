/**
 * Presentation-only mappings from indexed `pokemontype` strings (e.g. "Grass", "Fire")
 * to Tailwind utility classes — no new Coveo fields required.
 *
 * Two surfaces per type:
 *   pokemonTypePillClass   — compact colored pill (opaque bg, full contrast text)
 *   pokemonTypeCardClass   — subtle tinted card/article background
 *   pokemonTypeAccentClass — border + ring accent for focused/hovered cards
 *
 * Unknown types fall back to neutral zinc styling.
 */

/* ── Pill classes ────────────────────────────────────────────────────────── */
const TYPE_PILL_CLASS: Record<string, string> = {
  normal:   "bg-stone-400    text-white       ring-1 ring-stone-500/30",
  fire:     "bg-orange-500   text-white       ring-1 ring-orange-600/30",
  water:    "bg-sky-600      text-white       ring-1 ring-sky-700/30",
  electric: "bg-amber-400    text-amber-950   ring-1 ring-amber-500/40",
  grass:    "bg-emerald-600  text-white       ring-1 ring-emerald-700/30",
  ice:      "bg-cyan-400     text-cyan-950    ring-1 ring-cyan-500/40",
  fighting: "bg-red-700      text-white       ring-1 ring-red-800/30",
  poison:   "bg-violet-600   text-white       ring-1 ring-violet-700/30",
  ground:   "bg-amber-700    text-white       ring-1 ring-amber-800/30",
  flying:   "bg-indigo-400   text-indigo-950  ring-1 ring-indigo-500/40",
  psychic:  "bg-fuchsia-500  text-white       ring-1 ring-fuchsia-600/30",
  bug:      "bg-lime-600     text-white       ring-1 ring-lime-700/30",
  rock:     "bg-amber-800    text-white       ring-1 ring-amber-900/30",
  ghost:    "bg-violet-800   text-white       ring-1 ring-violet-900/30",
  dragon:   "bg-indigo-700   text-white       ring-1 ring-indigo-800/30",
  dark:     "bg-zinc-800     text-white       ring-1 ring-zinc-900/30",
  steel:    "bg-slate-500    text-white       ring-1 ring-slate-600/30",
  fairy:    "bg-pink-400     text-pink-950    ring-1 ring-pink-500/40",
  stellar:  "bg-teal-500     text-white       ring-1 ring-teal-600/30",
};

const PILL_FALLBACK = "bg-zinc-300 text-zinc-900 ring-1 ring-zinc-400/40";

/**
 * Spanish `pokemontype` labels (lowercased for lookup) → English slug keys used
 * in {@link TYPE_PILL_CLASS} / {@link TYPE_CARD_CLASS} / {@link TYPE_ACCENT_CLASS}.
 */
const SPANISH_TYPE_TO_SLUG: Record<string, string> = {
  normal: "normal",
  fuego: "fire",
  agua: "water",
  eléctrico: "electric",
  electrico: "electric",
  planta: "grass",
  hielo: "ice",
  lucha: "fighting",
  veneno: "poison",
  tierra: "ground",
  volador: "flying",
  psíquico: "psychic",
  psiquico: "psychic",
  bicho: "bug",
  roca: "rock",
  fantasma: "ghost",
  dragón: "dragon",
  dragon: "dragon",
  siniestro: "dark",
  acero: "steel",
  hada: "fairy",
};

/* ── Card surface tints ──────────────────────────────────────────────────── */
const TYPE_CARD_CLASS: Record<string, string> = {
  normal:   "bg-stone-50",
  fire:     "bg-orange-50",
  water:    "bg-sky-50",
  electric: "bg-amber-50",
  grass:    "bg-emerald-50",
  ice:      "bg-cyan-50",
  fighting: "bg-red-50",
  poison:   "bg-violet-50",
  ground:   "bg-amber-50/70",
  flying:   "bg-indigo-50",
  psychic:  "bg-fuchsia-50",
  bug:      "bg-lime-50",
  rock:     "bg-amber-50",
  ghost:    "bg-violet-50",
  dragon:   "bg-indigo-50",
  dark:     "bg-zinc-100",
  steel:    "bg-slate-50",
  fairy:    "bg-pink-50",
  stellar:  "bg-teal-50",
};

const CARD_FALLBACK = "bg-surface-base";

/* ── Border / ring accent ────────────────────────────────────────────────── */
const TYPE_ACCENT_CLASS: Record<string, string> = {
  normal:   "border-stone-200",
  fire:     "border-orange-200",
  water:    "border-sky-200",
  electric: "border-amber-200",
  grass:    "border-emerald-200",
  ice:      "border-cyan-200",
  fighting: "border-red-200",
  poison:   "border-violet-200",
  ground:   "border-amber-200",
  flying:   "border-indigo-200",
  psychic:  "border-fuchsia-200",
  bug:      "border-lime-200",
  rock:     "border-amber-300",
  ghost:    "border-violet-300",
  dragon:   "border-indigo-300",
  dark:     "border-zinc-400",
  steel:    "border-slate-300",
  fairy:    "border-pink-200",
  stellar:  "border-teal-200",
};

const ACCENT_FALLBACK = "border-border-default";

function typeStyleKey(typeName: string): string {
  const k = typeName.trim().toLowerCase();
  if (k in TYPE_PILL_CLASS) return k;
  return SPANISH_TYPE_TO_SLUG[k] ?? k;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export function pokemonTypePillClass(typeName: string): string {
  const key = typeStyleKey(typeName);
  return TYPE_PILL_CLASS[key] ?? PILL_FALLBACK;
}

/** Subtle tinted background for card/article surfaces. Pass the primary type. */
export function pokemonTypeCardClass(typeName: string): string {
  const key = typeStyleKey(typeName);
  return TYPE_CARD_CLASS[key] ?? CARD_FALLBACK;
}

/** Colored border/ring accent matching the type palette. */
export function pokemonTypeAccentClass(typeName: string): string {
  const key = typeStyleKey(typeName);
  return TYPE_ACCENT_CLASS[key] ?? ACCENT_FALLBACK;
}
