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
  SearchEngine,
} from "@coveo/headless";
import Link from "next/link";
import { PokemonIndexedImage } from "@/components/pokemon/PokemonIndexedImage";
import { PokemonTypePillRow } from "@/components/pokemon/PokemonTypePill";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/layout/Card";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  cleanIndexedPokemonTitle,
  formatNationalDex,
  nationalDexFromRaw,
} from "@/lib/nationalDex";

/** Stable IDs for CSS / design tokens — override via `[data-product-filter="…"]` in `globals.css`. */
export const PRODUCT_FILTER_IDS = {
  pokemonType:       "pokemon-type",
  pokemonGeneration: "pokemon-generation",
  pokemonAbility:    "pokemon-ability",
  pokemonBst:        "pokemon-bst",
} as const;

/* ── Facet UI ──────────────────────────────────────────────────────────── */

/**
 * Facet filters render as popovers: the option list floats over the page and does
 * not push the result grid. Only one facet menu is open at a time; click outside
 * or Escape closes it.
 */
function ProductFacetFilterSection({
  productFilterId,
  heading,
  open,
  onOpenChange,
  children,
}: {
  productFilterId: string;
  heading: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        onOpenChangeRef.current(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChangeRef.current(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const panelId = `facet-panel-${productFilterId}`;
  const triggerId = `facet-trigger-${productFilterId}`;

  return (
    <div
      ref={rootRef}
      className="product-filter relative w-full min-w-0 rounded-md border border-zinc-200 bg-white shadow-sm"
      data-product-filter={productFilterId}
    >
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className="product-filter__summary flex w-full cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700 outline-none ring-sky-500/30 focus-visible:ring-4"
      >
        <span className="product-filter__heading">{heading}</span>
        <svg
          className={`product-filter__disclosure-icon size-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
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
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={triggerId}
          className="product-filter__panel absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white px-3 pb-3 pt-2 shadow-lg"
        >
          <ul className="product-filter__options flex flex-col gap-1.5">{children}</ul>
        </div>
      )}
    </div>
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
    <li className="product-filter__option" data-filter-option={optionValue}>
      <label className="product-filter__control flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="product-filter__checkbox rounded border-zinc-400 text-sky-600 focus:ring-sky-500"
        />
        <span className="product-filter__option-label flex-1 truncate">
          {optionValue}
        </span>
        <span className="product-filter__count tabular-nums text-zinc-400">
          ({resultCount})
        </span>
      </label>
    </li>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function facetValues(raw: Record<string, unknown>, key: string): string[] {
  const v = raw[key];
  if (v == null) return [];
  const list = Array.isArray(v) ? v.map(String) : [String(v)];
  // Multi-form Pokémon (e.g. Enamorus Incarnate + Therian) can yield repeated
  // type/ability values in `raw`. Dedupe so cards don't show "Fairy, Flying,
  // Fairy, Flying" and so callers can safely key React lists on the value.
  return Array.from(new Set(list));
}

function bstFromRaw(raw: Record<string, unknown>): number | null {
  const v = raw.pokemonbst;
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ── PokemonCard ───────────────────────────────────────────────────────── */

function PokemonCard({ result }: { result: Result }) {
  const raw = result.raw as Record<string, unknown>;
  const picture =
    (raw.pictureuri as string | undefined) ||
    (raw.picture_uri as string | undefined) ||
    (raw.syspictureuri as string | undefined);
  const types = facetValues(raw, "pokemontype");
  const bst = bstFromRaw(raw);
  const name = cleanIndexedPokemonTitle(result.title);
  const ndex = nationalDexFromRaw(raw);
  const dexLabel = ndex != null ? formatNationalDex(ndex) : null;

  // Per-result Headless controller — re-created when the result object changes.
  // `select()` emits a `documentClick` analytics event the moment the user opens
  // the card, providing the training signal ART needs to re-rank future results.
  const interactiveResult = useMemo(
    () => buildInteractiveResult(getSearchEngine(), { options: { result } }),
    [result],
  );

  const slug = useMemo(() => slugFromClickUri(result.clickUri), [result.clickUri]);

  const cardBody = (
    <article className="flex h-full flex-col rounded-md bg-white transition-transform duration-150 group-hover:-translate-y-0.5">
      <div className="relative aspect-square w-full overflow-hidden rounded bg-zinc-100">
        {picture ? (
          <PokemonIndexedImage
            src={picture}
            sizes="(max-width:640px) 45vw, (max-width:1024px) 25vw, 160px"
            boxClassName="h-full w-full bg-zinc-100"
            imageClassName="object-contain p-2"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3 py-3 text-left">
        {(dexLabel != null || bst != null) && (
        <p className="text-[11px] font-medium tabular-nums leading-snug text-zinc-500">
          {dexLabel != null && <span className="text-zinc-600">{dexLabel}</span>}
          {dexLabel != null && bst != null && (
            <span className="mx-1.5 text-zinc-300" aria-hidden>
              ·
            </span>
          )}
          {bst != null && (
            <span className="font-semibold text-sky-600" aria-label={`Base Stat Total ${bst}`}>
              BST {bst}
            </span>
          )}
        </p>
        )}
        <h2 className="line-clamp-1 text-lg font-semibold leading-snug text-zinc-950 group-hover:text-sky-700">
          {name}
        </h2>
        <PokemonTypePillRow types={types} className="justify-start gap-1" />
      </div>
    </article>
  );

  if (!slug) return cardBody;

  return (
    <Link
      href={`/pokemon/${slug}`}
      onClick={() => interactiveResult.select()}
      className="group block h-full rounded-md outline-none ring-sky-500/40 focus-visible:ring-4"
      aria-label={`View details for ${name}`}
    >
      {cardBody}
    </Link>
  );
}

/* ── Engine state ──────────────────────────────────────────────────────── */

type SearchEngineSnapshot = SearchEngine["state"];

function lastSearchError(s: SearchEngineSnapshot): unknown {
  const search = (s as { search?: { error?: unknown } }).search;
  return search?.error ?? null;
}

function useSearchEngineState(): SearchEngineSnapshot {
  const engine = useMemo(() => getSearchEngine(), []);
  const [state, setState] = useState<SearchEngineSnapshot>(() => engine.state);
  useEffect(() => {
    setState(engine.state);
    return engine.subscribe(() => setState(engine.state));
  }, [engine]);
  return state;
}

function formatSearchEngineError(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "object" && "message" in error) {
    const m = (error as { message?: string }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return "Search request failed.";
}

/* ── Banners ───────────────────────────────────────────────────────────── */

function SearchFailureBanner({ message }: { message: string }) {
  const isLikelyCspOrNetwork =
    /could not connect|Disconnected|Failed to fetch|statusCode:\s*0/i.test(message);
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-50"
    >
      <p className="font-semibold">Search could not reach Coveo</p>
      <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{message}</p>
      {isLikelyCspOrNetwork && (
        <p className="mt-3 text-xs leading-relaxed text-rose-900/90 dark:text-rose-100/90">
          If this appeared after tightening Content-Security-Policy, ensure{" "}
          <code className="rounded bg-rose-100/80 px-1 font-mono text-[11px] dark:bg-rose-900/60">
            connect-src
          </code>{" "}
          allows Coveo Search on{" "}
          <code className="rounded bg-rose-100/80 px-1 font-mono text-[11px] dark:bg-rose-900/60">
            https://*.org.coveo.com
          </code>{" "}
          (and your existing{" "}
          <code className="rounded bg-rose-100/80 px-1 font-mono text-[11px] dark:bg-rose-900/60">
            *.cloud.coveo.com
          </code>{" "}
          hosts). Then hard-refresh the page.
        </p>
      )}
    </div>
  );
}

function EnvMissingBanner() {
  return (
    <AppShell maxWidth="lg">
      <Card>
        <p className="font-medium text-text-primary">Coveo environment variables missing</p>
        <p className="mt-2 text-sm text-text-secondary">
          Copy{" "}
          <code className="rounded bg-surface-overlay px-1 dark:bg-zinc-800">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-surface-overlay px-1 dark:bg-zinc-800">
            .env.local
          </code>{" "}
          and set{" "}
          <code className="rounded bg-surface-overlay px-1 dark:bg-zinc-800">
            NEXT_PUBLIC_COVEO_ORG_ID
          </code>{" "}
          and{" "}
          <code className="rounded bg-surface-overlay px-1 dark:bg-zinc-800">
            NEXT_PUBLIC_COVEO_API_KEY
          </code>
          .
        </p>
      </Card>
    </AppShell>
  );
}

/* ── RGA Panel ─────────────────────────────────────────────────────────── */

/**
 * Coveo RGA (Relevance Generative Answering) panel.
 * Renders only when the model produces (or is producing) an answer.
 * Silent fallback when RGA isn't configured — stays null.
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
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
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
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
          {state.answer}
        </div>
      )}

      {hasError && !hasAnswer && (
        <div className="text-sm text-text-secondary">
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
        <footer className="mt-4 flex items-center gap-2 text-xs text-text-muted">
          <span>Was this helpful?</span>
          <button
            type="button"
            onClick={() => controller.like()}
            disabled={state.feedbackSubmitted}
            aria-pressed={state.liked}
            className={`rounded-md px-2 py-1 transition-colors ${
              state.liked
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                : "hover:bg-surface-overlay dark:hover:bg-zinc-800"
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
                : "hover:bg-surface-overlay dark:hover:bg-zinc-800"
            }`}
          >
            👎
          </button>
          {state.feedbackSubmitted && (
            <span className="ml-1 text-emerald-700 dark:text-emerald-300">Thanks!</span>
          )}
        </footer>
      )}
    </section>
  );
}

/* ── Search box ────────────────────────────────────────────────────────── */

/**
 * Combobox-pattern search input with Coveo Query Suggestions.
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
          effectiveActiveIndex >= 0 ? `${listboxId}-${effectiveActiveIndex}` : undefined
        }
        autoComplete="off"
        value={state.value}
        onChange={(e) => {
          searchBox.updateText(e.target.value);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setIsOpen(true);
          searchBox.showSuggestions();
        }}
        onBlur={() => {
          blurTimerRef.current = window.setTimeout(() => setIsOpen(false), 120);
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
              searchBox.selectSuggestion(suggestions[effectiveActiveIndex].rawValue);
              setIsOpen(false);
            }
          } else if (e.key === "Escape") {
            setIsOpen(false);
            setActiveIndex(-1);
          }
        }}
        placeholder="Search Pokémon…"
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm outline-none ring-sky-500/25 focus:border-sky-500 focus:ring-4"
        aria-label="Search"
      />
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-md border border-zinc-300 bg-white py-1 shadow-lg"
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
              className={`cursor-pointer px-3 py-1.5 text-sm text-zinc-800 ${
                idx === effectiveActiveIndex
                  ? "bg-sky-50"
                  : "hover:bg-zinc-100"
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

/* ── Main configured interface ─────────────────────────────────────────── */

function SearchInterfaceConfigured() {
  const controllers = getSearchControllers();
  const engineState = useSearchEngineState();
  const searchError = lastSearchError(engineState);
  const searchBoxState = useCoveoController(controllers.searchBox);
  const resultState = useCoveoController(controllers.resultList);
  const typeFacetState = useCoveoController(controllers.typeFacet);
  const genFacetState = useCoveoController(controllers.generationFacet);
  const abilityFacetState = useCoveoController(controllers.abilityFacet);
  const bstFacetState = useCoveoController(controllers.bstFacet);
  const generatedAnswerState = useCoveoController(controllers.generatedAnswer);

  const hasGeneratedAnswer =
    Boolean(generatedAnswerState.answer?.trim()) ||
    generatedAnswerState.isLoading ||
    generatedAnswerState.isStreaming ||
    Boolean(generatedAnswerState.error?.message);

  const firstSearchDone = useRef(false);
  useEffect(() => {
    if (firstSearchDone.current) return;
    firstSearchDone.current = true;
    getSearchEngine().executeFirstSearch();
  }, []);

  const [openFacetId, setOpenFacetId] = useState<string | null>(null);

  const filterPanel = (
    <div
      className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-4"
      data-region="product-filters"
      aria-label="Product filters"
    >
      <ProductFacetFilterSection
        productFilterId={PRODUCT_FILTER_IDS.pokemonType}
        heading="Pokémon type"
        open={openFacetId === PRODUCT_FILTER_IDS.pokemonType}
        onOpenChange={(next) =>
          setOpenFacetId(next ? PRODUCT_FILTER_IDS.pokemonType : null)
        }
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
        open={openFacetId === PRODUCT_FILTER_IDS.pokemonGeneration}
        onOpenChange={(next) =>
          setOpenFacetId(next ? PRODUCT_FILTER_IDS.pokemonGeneration : null)
        }
      >
        {genFacetState.values.map((v) => (
          <ProductFacetOptionRow
            key={v.value}
            optionValue={v.value}
            resultCount={v.numberOfResults}
            selected={v.state === "selected"}
            onToggle={() => controllers.generationFacet.toggleSelect(v)}
          />
        ))}
      </ProductFacetFilterSection>

      <ProductFacetFilterSection
        productFilterId={PRODUCT_FILTER_IDS.pokemonAbility}
        heading="Ability"
        open={openFacetId === PRODUCT_FILTER_IDS.pokemonAbility}
        onOpenChange={(next) =>
          setOpenFacetId(next ? PRODUCT_FILTER_IDS.pokemonAbility : null)
        }
      >
        {!resultState.isLoading && abilityFacetState.values.length === 0 && (
          <li className="product-filter__option px-1 py-1 text-xs leading-relaxed text-zinc-500">
            No ability values from Coveo yet. In Admin → Content → Fields, open{" "}
            <code className="rounded bg-zinc-100 px-1">
              pokemonability
            </code>{" "}
            and confirm Facet is enabled (and Multi-value facet if each species has
            multiple abilities). Run a source rebuild, then hard-refresh this page.
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
        open={openFacetId === PRODUCT_FILTER_IDS.pokemonBst}
        onOpenChange={(next) =>
          setOpenFacetId(next ? PRODUCT_FILTER_IDS.pokemonBst : null)
        }
      >
        {!resultState.isLoading &&
          bstFacetState.values.length > 0 &&
          bstFacetState.values.every((v) => v.numberOfResults === 0) && (
            <li className="product-filter__option px-1 py-1 text-xs leading-relaxed text-zinc-500">
              No BST data from Coveo yet. In Admin → Content → Fields, confirm{" "}
              <code className="rounded bg-zinc-100 px-1">
                pokemonbst
              </code>{" "}
              exists with a numeric <strong>Type</strong> and{" "}
              <strong>Facet = Yes</strong>, then rebuild the source.
            </li>
          )}
        {bstFacetState.values.map((v) => {
          const tier = bstTierForRange(v.start, v.end);
          const label = tier ? `${tier.label} (${tier.suffix})` : `${v.start}–${v.end}`;
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
    </div>
  );

  const resultArea = (
    <div className="min-w-0 space-y-4">
      {searchError != null && (
        <SearchFailureBanner message={formatSearchEngineError(searchError)} />
      )}
      {hasGeneratedAnswer && (
        <GeneratedAnswerPanel
          controller={controllers.generatedAnswer}
          state={generatedAnswerState}
        />
      )}
      <p className="text-sm text-zinc-500">
        {searchError != null
          ? "No results loaded (search failed)."
          : resultState.isLoading
            ? "Loading…"
            : `${resultState.results.length} result${resultState.results.length === 1 ? "" : "s"}`}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
        {resultState.results.map((result) => (
          <PokemonCard key={result.uniqueId} result={result} />
        ))}
      </div>
    </div>
  );

  return (
    <AppShell
      maxWidth="full"
      spacing="compact"
      className="max-w-[42rem] bg-white/95"
    >
      <div className="flex flex-col gap-5">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Coveo Pokédex
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">
                Pokémon search
              </h1>
            </div>
            <form
              className="flex w-full gap-2 sm:w-[22rem]"
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
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                Search
              </button>
            </form>
          </div>
          {filterPanel}
        </header>

        {resultArea}

        {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ? (
          <p className="mt-4 text-center text-[10px] tabular-nums text-zinc-400">
            Git build{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-zinc-600">
              {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}
            </code>
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

/* ── Public export ─────────────────────────────────────────────────────── */

export function SearchInterface() {
  if (!coveoConfigured()) {
    return <EnvMissingBanner />;
  }
  return <SearchInterfaceConfigured />;
}
