"use client";

import {
  getSearchControllers,
  getSearchEngine,
  coveoConfigured,
} from "@/coveo/search-instance";
import { useCoveoController } from "@/hooks/useCoveoController";
import type { Result } from "@coveo/headless";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

/** Stable IDs for CSS / design tokens — override via `[data-product-filter="…"]` in `globals.css`. */
export const PRODUCT_FILTER_IDS = {
  pokemonType: "pokemon-type",
  pokemonGeneration: "pokemon-generation",
  pokemonAbility: "pokemon-ability",
} as const;

function ProductFacetFilterSection({
  productFilterId,
  heading,
  children,
}: {
  productFilterId: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <details
      className="product-filter group rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40"
      data-product-filter={productFilterId}
    >
      <summary className="product-filter__summary flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-zinc-800 outline-none ring-emerald-500/40 focus-visible:ring-4 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
        <span className="product-filter__heading">{heading}</span>
        <svg
          className="product-filter__disclosure-icon size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180 dark:text-zinc-400"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="product-filter__panel border-t border-zinc-200/80 px-3 pb-3 pt-2 dark:border-zinc-700/80">
        <ul className="product-filter__options flex flex-col gap-1.5">{children}</ul>
      </div>
    </details>
  );
}

function ProductFacetOptionRow({
  optionValue,
  resultCount,
  selected,
  onToggle,
}: {
  optionValue: string;
  resultCount: number;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className="product-filter__option"
      data-filter-option={optionValue}
    >
      <label className="product-filter__control flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="product-filter__checkbox rounded border-zinc-400 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-500"
        />
        <span className="product-filter__option-label flex-1 truncate">
          {optionValue}
        </span>
        <span className="product-filter__count tabular-nums text-zinc-400 dark:text-zinc-500">
          ({resultCount})
        </span>
      </label>
    </li>
  );
}

function facetValues(raw: Record<string, unknown>, key: string): string[] {
  const v = raw[key];
  if (v == null) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

/** Abilities from `result.raw` — splits semicolon-joined strings when the index stores one value. */
function abilityValuesFromRaw(raw: Record<string, unknown>): string[] {
  const list = facetValues(raw, "pokemonability");
  if (list.length === 1 && list[0].includes(";")) {
    return list[0]
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return list;
}

function PokemonCard({ result }: { result: Result }) {
  const raw = result.raw as Record<string, unknown>;
  const picture =
    (raw.pictureuri as string | undefined) ||
    (raw.picture_uri as string | undefined) ||
    (raw.syspictureuri as string | undefined);
  const types = facetValues(raw, "pokemontype");
  const abilities = abilityValuesFromRaw(raw);
  const generation =
    (raw.pokemongeneration as string | undefined) ||
    (raw.pokemon_generation as string | undefined);

  return (
    <article className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic Coveo image URLs
          <img
            src={picture}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          <a
            href={result.clickUri}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {result.title}
          </a>
        </h2>
        {types.length > 0 && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Types: {types.join(", ")}
          </p>
        )}
        {abilities.length > 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Abilities: {abilities.join(", ")}
          </p>
        )}
        {generation && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {generation}
          </p>
        )}
      </div>
    </article>
  );
}

function EnvMissingBanner() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">Coveo environment variables missing</p>
        <p className="mt-2 text-sm">
          Copy{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">
            .env.local
          </code>{" "}
          and set{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">
            NEXT_PUBLIC_COVEO_ORG_ID
          </code>{" "}
          and{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">
            NEXT_PUBLIC_COVEO_API_KEY
          </code>
          .
        </p>
      </div>
    </div>
  );
}

function SearchInterfaceConfigured() {
  const controllers = getSearchControllers();
  const searchBoxState = useCoveoController(controllers.searchBox);
  const resultState = useCoveoController(controllers.resultList);
  const typeFacetState = useCoveoController(controllers.typeFacet);
  const genFacetState = useCoveoController(controllers.generationFacet);
  const abilityFacetState = useCoveoController(controllers.abilityFacet);

  const firstSearchDone = useRef(false);

  useEffect(() => {
    if (firstSearchDone.current) return;
    firstSearchDone.current = true;
    getSearchEngine().executeFirstSearch();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pokémon search
        </h1>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            controllers.searchBox.submit();
          }}
        >
          <input
            type="search"
            value={searchBoxState.value}
            onChange={(e) =>
              controllers.searchBox.updateText(e.target.value)
            }
            placeholder="Search Pokémon…"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 shadow-sm outline-none ring-emerald-500/40 focus:border-emerald-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            aria-label="Search"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            Search
          </button>
        </form>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside
          className="facet-sidebar flex w-full shrink-0 flex-col gap-3 lg:w-72"
          data-region="product-filters"
          aria-label="Product filters"
        >
          <ProductFacetFilterSection
            productFilterId={PRODUCT_FILTER_IDS.pokemonType}
            heading="Pokémon type"
          >
            {typeFacetState.values.map((v) => (
              <ProductFacetOptionRow
                key={v.value}
                optionValue={v.value}
                resultCount={v.numberOfResults}
                selected={v.state === "selected"}
                onToggle={() => controllers.typeFacet.toggleSelect(v)}
              />
            ))}
          </ProductFacetFilterSection>
          <ProductFacetFilterSection
            productFilterId={PRODUCT_FILTER_IDS.pokemonGeneration}
            heading="Generation"
          >
            {genFacetState.values.map((v) => (
              <ProductFacetOptionRow
                key={v.value}
                optionValue={v.value}
                resultCount={v.numberOfResults}
                selected={v.state === "selected"}
                onToggle={() =>
                  controllers.generationFacet.toggleSelect(v)
                }
              />
            ))}
          </ProductFacetFilterSection>
          <ProductFacetFilterSection
            productFilterId={PRODUCT_FILTER_IDS.pokemonAbility}
            heading="Ability"
          >
            {!resultState.isLoading &&
              abilityFacetState.values.length === 0 && (
                <li className="product-filter__option px-1 py-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  No ability values from Coveo yet. In Admin → Content → Fields, open{" "}
                  <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">
                    pokemonability
                  </code>{" "}
                  and confirm Facet is enabled (and Multi-value facet if each species
                  has multiple abilities). Run a source rebuild, then hard-refresh this
                  page. In DevTools → Network, inspect the search POST: the response
                  should include a facet for{" "}
                  <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">
                    pokemonability
                  </code>{" "}
                  with values.
                </li>
              )}
            {abilityFacetState.values.map((v) => (
              <ProductFacetOptionRow
                key={v.value}
                optionValue={v.value}
                resultCount={v.numberOfResults}
                selected={v.state === "selected"}
                onToggle={() => controllers.abilityFacet.toggleSelect(v)}
              />
            ))}
          </ProductFacetFilterSection>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <p className="text-sm text-zinc-500">
            {resultState.isLoading
              ? "Loading…"
              : `${resultState.results.length} result${resultState.results.length === 1 ? "" : "s"}`}
          </p>
          <div className="flex flex-col gap-4">
            {resultState.results.map((result) => (
              <PokemonCard key={result.uniqueId} result={result} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function SearchInterface() {
  if (!coveoConfigured()) {
    return <EnvMissingBanner />;
  }
  return <SearchInterfaceConfigured />;
}
