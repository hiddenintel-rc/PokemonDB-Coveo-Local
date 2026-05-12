"use client";

import {
  bstTierForRange,
  getSearchControllers,
  getSearchEngine,
  coveoConfigured,
} from "@/coveo/search-instance";
import { slugFromClickUri } from "@/coveo/fetch-pokemon-by-slug";
import { useCoveoController } from "@/hooks/useCoveoController";
import { buildInteractiveResult } from "@coveo/headless";
import type {
  GeneratedAnswer,
  GeneratedAnswerState,
  Result,
  SearchBox,
  SearchBoxState,
} from "@coveo/headless";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

/** Stable IDs for CSS / design tokens — override via `[data-product-filter="…"]` in `globals.css`. */
export const PRODUCT_FILTER_IDS = {
  pokemonType: "pokemon-type",
  pokemonGeneration: "pokemon-generation",
  pokemonAbility: "pokemon-ability",
  pokemonBst: "pokemon-bst",
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

/** BST (integer) from `result.raw`. Tolerates string vs number serialization and missing field. */
function bstFromRaw(raw: Record<string, unknown>): number | null {
  const v = raw.pokemonbst;
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function PokemonCard({ result }: { result: Result }) {
  const raw = result.raw as Record<string, unknown>;
  const picture =
    (raw.pictureuri as string | undefined) ||
    (raw.picture_uri as string | undefined) ||
    (raw.syspictureuri as string | undefined);
  const types = facetValues(raw, "pokemontype");
  const abilities = abilityValuesFromRaw(raw);
  const bst = bstFromRaw(raw);
  const generation =
    (raw.pokemongeneration as string | undefined) ||
    (raw.pokemon_generation as string | undefined);

  // Per-result Headless controller — re-created when the result object changes.
  // `select()` emits a `documentClick` analytics event the moment the user opens
  // the card, providing the training signal Automatic Relevance Tuning (ART)
  // needs to re-rank future result lists.
  const interactiveResult = useMemo(
    () => buildInteractiveResult(getSearchEngine(), { options: { result } }),
    [result],
  );

  const slug = useMemo(() => slugFromClickUri(result.clickUri), [result.clickUri]);

  const cardBody = (
    <article className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors group-hover:border-emerald-300 group-hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-950 dark:group-hover:border-emerald-800/60 dark:group-hover:bg-emerald-950/20">
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
        <div className="flex items-baseline gap-2">
          <h2 className="truncate text-lg font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
            {result.title}
          </h2>
          {bst != null && (
            <span
              className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
              title="Base Stat Total"
              aria-label={`Base Stat Total ${bst}`}
            >
              BST {bst}
            </span>
          )}
        </div>
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

  // Fallback for the unlikely case where the result has no parseable slug —
  // render an inert card so the rest of the result list still works.
  if (!slug) return cardBody;

  return (
    <Link
      href={`/pokemon/${slug}`}
      onClick={() => interactiveResult.select()}
      className="group block rounded-xl outline-none ring-emerald-500/40 focus-visible:ring-4"
      aria-label={`View details for ${result.title}`}
    >
      {cardBody}
    </Link>
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

/**
 * Coveo RGA (Relevance Generative Answering) panel.
 * - Renders only when the model produces (or is producing) an answer.
 * - Silent fallback when the model isn't associated to the pipeline OR the org doesn't have
 *   RGA enabled — `state.answer` stays undefined and `isLoading` stays false.
 * - Plain-text rendering of the answer (no `dangerouslySetInnerHTML` per security audit);
 *   `whitespace-pre-wrap` preserves line breaks the LLM produces.
 */
function GeneratedAnswerPanel({
  controller,
  state,
}: {
  controller: GeneratedAnswer;
  state: GeneratedAnswerState;
}) {
  const hasAnswer = Boolean(state.answer && state.answer.trim().length > 0);
  const isThinking = state.isLoading || state.isStreaming;
  const hasError = Boolean(state.error?.message);

  if (!hasAnswer && !isThinking && !hasError) return null;
  if (state.cannotAnswer && !hasAnswer) return null;

  return (
    <section
      aria-label="AI generated answer"
      data-region="generated-answer"
      className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-zinc-950"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4L12 2zM5 14l1 2.6L8 17l-2 .4L5 20l-1-2.6L2 17l2-.4L5 14zm14 0l1 2.6L22 17l-2 .4L19 20l-1-2.6L16 17l2-.4L19 14z" />
          </svg>
          AI-generated answer
          {isThinking && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-emerald-600/80 dark:text-emerald-400/80">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              {state.isStreaming ? "answering…" : "thinking…"}
            </span>
          )}
        </div>
      </header>

      {hasAnswer && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
          {state.answer}
        </div>
      )}

      {hasError && !hasAnswer && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Generated answer unavailable.
          {state.error?.isRetryable && (
            <button
              type="button"
              onClick={() => controller.retry()}
              className="ml-2 underline hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {state.citations.length > 0 && (
        <ol className="mt-4 flex flex-wrap gap-2">
          {state.citations.map((c, idx) => {
            const href = c.clickUri ?? c.uri;
            return (
              <li key={c.id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    state.answerId
                      ? controller.logCitationClick(c.id, state.answerId)
                      : controller.logCitationClick(c.id)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs text-emerald-800 shadow-sm hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                >
                  <span className="font-semibold">[{idx + 1}]</span>
                  <span className="max-w-[20ch] truncate">{c.title}</span>
                </a>
              </li>
            );
          })}
        </ol>
      )}

      {hasAnswer && !isThinking && (
        <footer className="mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Was this helpful?</span>
          <button
            type="button"
            onClick={() => controller.like()}
            disabled={state.feedbackSubmitted}
            aria-pressed={state.liked}
            className={`rounded-md px-2 py-1 transition-colors ${
              state.liked
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => controller.dislike()}
            disabled={state.feedbackSubmitted}
            aria-pressed={state.disliked}
            className={`rounded-md px-2 py-1 transition-colors ${
              state.disliked
                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            👎
          </button>
          {state.feedbackSubmitted && (
            <span className="ml-1 text-emerald-700 dark:text-emerald-300">
              Thanks!
            </span>
          )}
        </footer>
      )}
    </section>
  );
}

/**
 * Combobox-pattern search input with Coveo Query Suggestions.
 * - Suggestions come from `state.suggestions` (populated by the QS model on the active pipeline).
 * - `selectSuggestion` updates the search box value AND submits — no separate submit needed.
 * - Keyboard: ArrowDown/Up navigates, Enter applies the highlighted suggestion (or submits the
 *   current text if none is highlighted), Escape closes the dropdown.
 */
function SearchBoxWithSuggestions({
  searchBox,
  state,
}: {
  searchBox: SearchBox;
  state: SearchBoxState;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimerRef = useRef<number | undefined>(undefined);
  const listboxId = "search-suggestions";

  useEffect(
    () => () => {
      if (blurTimerRef.current !== undefined)
        window.clearTimeout(blurTimerRef.current);
    },
    [],
  );

  const suggestions = state.suggestions;
  const showList = isOpen && suggestions.length > 0;
  // Guard against activeIndex outlasting a shrunk suggestion list (e.g. the
  // user typed and the QS model returned fewer candidates than before).
  const effectiveActiveIndex =
    activeIndex >= 0 && activeIndex < suggestions.length ? activeIndex : -1;

  return (
    <div className="relative flex-1">
      <input
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={
          effectiveActiveIndex >= 0
            ? `${listboxId}-${effectiveActiveIndex}`
            : undefined
        }
        autoComplete="off"
        value={state.value}
        onChange={(e) => {
          searchBox.updateText(e.target.value);
          // Typing always invalidates the current highlight — the suggestion
          // list is about to change shape.
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setIsOpen(true);
          searchBox.showSuggestions();
        }}
        onBlur={() => {
          blurTimerRef.current = window.setTimeout(
            () => setIsOpen(false),
            120,
          );
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIsOpen(true);
            setActiveIndex((i) =>
              suggestions.length === 0 ? -1 : Math.min(i + 1, suggestions.length - 1),
            );
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter") {
            if (showList && effectiveActiveIndex >= 0) {
              e.preventDefault();
              searchBox.selectSuggestion(
                suggestions[effectiveActiveIndex].rawValue,
              );
              setIsOpen(false);
            }
          } else if (e.key === "Escape") {
            setIsOpen(false);
            setActiveIndex(-1);
          }
        }}
        placeholder="Search Pokémon…"
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 shadow-sm outline-none ring-emerald-500/40 focus:border-emerald-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        aria-label="Search"
      />
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-lg border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {suggestions.map((sug, idx) => (
            <li
              id={`${listboxId}-${idx}`}
              key={`${sug.rawValue}-${idx}`}
              role="option"
              aria-selected={idx === effectiveActiveIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                searchBox.selectSuggestion(sug.rawValue);
                setIsOpen(false);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`cursor-pointer px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 ${
                idx === effectiveActiveIndex
                  ? "bg-emerald-50 dark:bg-emerald-900/30"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
              }`}
            >
              {sug.rawValue}
            </li>
          ))}
        </ul>
      )}
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
  const bstFacetState = useCoveoController(controllers.bstFacet);
  const generatedAnswerState = useCoveoController(controllers.generatedAnswer);

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
          <SearchBoxWithSuggestions
            searchBox={controllers.searchBox}
            state={searchBoxState}
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
          <ProductFacetFilterSection
            productFilterId={PRODUCT_FILTER_IDS.pokemonBst}
            heading="Base stat total"
          >
            {/*
              Numeric facet with fixed `currentValues` always returns the 5 tier ranges,
              so values.length is constant. When `pokemonbst` is missing from the index
              every count is 0 — surface a one-line hint so the empty state isn't silent.
            */}
            {!resultState.isLoading &&
              bstFacetState.values.length > 0 &&
              bstFacetState.values.every((v) => v.numberOfResults === 0) && (
                <li className="product-filter__option px-1 py-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  No BST data from Coveo yet. In Admin → Content → Fields, confirm{" "}
                  <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">
                    pokemonbst
                  </code>{" "}
                  exists with a numeric <strong>Type</strong> (<em>Integer 32</em> on
                  trial orgs, or <em>Long</em>) and <strong>Facet = Yes</strong>, then
                  rebuild the source.
                </li>
              )}
            {bstFacetState.values.map((v) => {
              const tier = bstTierForRange(v.start, v.end);
              const label = tier
                ? `${tier.label} (${tier.suffix})`
                : `${v.start}–${v.end}`;
              return (
                <ProductFacetOptionRow
                  key={`${v.start}-${v.end}`}
                  optionValue={label}
                  resultCount={v.numberOfResults}
                  selected={v.state === "selected"}
                  onToggle={() => controllers.bstFacet.toggleSelect(v)}
                />
              );
            })}
          </ProductFacetFilterSection>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <GeneratedAnswerPanel
            controller={controllers.generatedAnswer}
            state={generatedAnswerState}
          />
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
