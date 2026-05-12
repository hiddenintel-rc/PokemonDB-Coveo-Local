"use client";

import { use } from "react";
import { PokemonDetailView } from "@/components/pokemon/PokemonDetailView";

/**
 * Pokémon detail route — Next.js 16 App Router dynamic segment.
 *
 * Why client-side:
 *   - Reuses the same NEXT_PUBLIC_COVEO_* credentials already in the browser
 *     (no server-side credential plumbing introduced for this iteration).
 *   - Symmetrical with the rest of the app (SearchInterface is also client-side).
 *
 * `params` is a Promise in Next.js 15+; React's `use()` unwraps it.
 * The fetch + render lifecycle lives in `PokemonDetailView`.
 */
export default function PokemonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      {/* `key={slug}` remounts the view (and resets its state to "loading")
          when navigating between detail pages without an in-effect setState. */}
      <PokemonDetailView key={slug} slug={slug} />
    </div>
  );
}
