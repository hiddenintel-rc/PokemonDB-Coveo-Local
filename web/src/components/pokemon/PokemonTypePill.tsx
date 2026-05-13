import { pokemonTypePillClass } from "@/lib/pokemonTypeStyles";

/** Colored pill for a single `pokemontype` value from Coveo (presentation only). */
export function PokemonTypePill({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex min-h-4 min-w-14 items-center justify-center rounded-sm px-2 py-0.5 text-[10px] font-semibold leading-none shadow-sm ${pokemonTypePillClass(type)}`}
    >
      {type}
    </span>
  );
}

export function PokemonTypePillRow({
  types,
  className = "",
}: {
  types: string[];
  className?: string;
}) {
  if (types.length === 0) return null;
  return (
    <div className={`flex flex-wrap justify-center gap-1 ${className}`}>
      {types.map((t) => (
        <PokemonTypePill key={t} type={t} />
      ))}
    </div>
  );
}
