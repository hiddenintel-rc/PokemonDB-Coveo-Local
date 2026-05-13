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

const PILL_FALLBACK =
  "bg-zinc-300 text-zinc-900 ring-1 ring-zinc-400/40 dark:bg-zinc-600 dark:text-zinc-50 dark:ring-zinc-500/40";

/* ── Card surface tints ──────────────────────────────────────────────────── */
const TYPE_CARD_CLASS: Record<string, string> = {
  normal:   "bg-stone-50    dark:bg-stone-950/30",
  fire:     "bg-orange-50   dark:bg-orange-950/25",
  water:    "bg-sky-50      dark:bg-sky-950/25",
  electric: "bg-amber-50    dark:bg-amber-950/25",
  grass:    "bg-emerald-50  dark:bg-emerald-950/25",
  ice:      "bg-cyan-50     dark:bg-cyan-950/25",
  fighting: "bg-red-50      dark:bg-red-950/25",
  poison:   "bg-violet-50   dark:bg-violet-950/25",
  ground:   "bg-amber-50/70 dark:bg-amber-950/20",
  flying:   "bg-indigo-50   dark:bg-indigo-950/25",
  psychic:  "bg-fuchsia-50  dark:bg-fuchsia-950/25",
  bug:      "bg-lime-50     dark:bg-lime-950/25",
  rock:     "bg-amber-50    dark:bg-amber-950/20",
  ghost:    "bg-violet-50   dark:bg-violet-950/20",
  dragon:   "bg-indigo-50   dark:bg-indigo-950/20",
  dark:     "bg-zinc-100    dark:bg-zinc-900/60",
  steel:    "bg-slate-50    dark:bg-slate-950/25",
  fairy:    "bg-pink-50     dark:bg-pink-950/25",
  stellar:  "bg-teal-50     dark:bg-teal-950/25",
};

const CARD_FALLBACK = "bg-surface-base";

/* ── Border / ring accent ────────────────────────────────────────────────── */
const TYPE_ACCENT_CLASS: Record<string, string> = {
  normal:   "border-stone-200   dark:border-stone-800/60",
  fire:     "border-orange-200  dark:border-orange-800/60",
  water:    "border-sky-200     dark:border-sky-800/60",
  electric: "border-amber-200   dark:border-amber-800/60",
  grass:    "border-emerald-200 dark:border-emerald-800/60",
  ice:      "border-cyan-200    dark:border-cyan-800/60",
  fighting: "border-red-200     dark:border-red-800/60",
  poison:   "border-violet-200  dark:border-violet-800/60",
  ground:   "border-amber-200   dark:border-amber-800/50",
  flying:   "border-indigo-200  dark:border-indigo-800/60",
  psychic:  "border-fuchsia-200 dark:border-fuchsia-800/60",
  bug:      "border-lime-200    dark:border-lime-800/60",
  rock:     "border-amber-300   dark:border-amber-800/50",
  ghost:    "border-violet-300  dark:border-violet-800/50",
  dragon:   "border-indigo-300  dark:border-indigo-800/50",
  dark:     "border-zinc-400    dark:border-zinc-700/80",
  steel:    "border-slate-300   dark:border-slate-700/60",
  fairy:    "border-pink-200    dark:border-pink-800/60",
  stellar:  "border-teal-200    dark:border-teal-800/60",
};

const ACCENT_FALLBACK = "border-border-default";

/* ── Public API ──────────────────────────────────────────────────────────── */

export function pokemonTypePillClass(typeName: string): string {
  const key = typeName.trim().toLowerCase();
  return TYPE_PILL_CLASS[key] ?? PILL_FALLBACK;
}

/** Subtle tinted background for card/article surfaces. Pass the primary type. */
export function pokemonTypeCardClass(typeName: string): string {
  const key = typeName.trim().toLowerCase();
  return TYPE_CARD_CLASS[key] ?? CARD_FALLBACK;
}

/** Colored border/ring accent matching the type palette. */
export function pokemonTypeAccentClass(typeName: string): string {
  const key = typeName.trim().toLowerCase();
  return TYPE_ACCENT_CLASS[key] ?? ACCENT_FALLBACK;
}
