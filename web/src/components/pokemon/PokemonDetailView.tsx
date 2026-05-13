"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchPokemonBySlug,
  normalizeSlug,
  type PokemonDetailHit,
} from "@/coveo/fetch-pokemon-by-slug";
import { PokemonIndexedImage } from "@/components/pokemon/PokemonIndexedImage";
import { BST_TIERS } from "@/coveo/search-instance";

type ViewState =
  | { status: "loading" }
  | { status: "found"; hit: PokemonDetailHit }
  | { status: "notfound" }
  | { status: "error"; message: string };

function rawValues(raw: Record<string, unknown>, key: string): string[] {
  const v = raw[key];
  if (v == null) return [];
  let list: string[];
  if (Array.isArray(v)) {
    list = v.map(String).filter(Boolean);
  } else {
    const s = String(v);
    // Some custom fields store multi-value content as a semicolon-joined string;
    // this matches the existing handling in `SearchInterface.tsx`.
    list = s.includes(";")
      ? s.split(";").map((p) => p.trim()).filter(Boolean)
      : [s];
  }
  // Multi-form Pokémon (e.g. Enamorus Incarnate + Therian) often produce repeated
  // values for `pokemontype` / `pokemonability` in `raw`. Dedupe so we never render
  // two identical badges (and so React's key uniqueness invariant is preserved when
  // the value itself is used as the list key downstream).
  return Array.from(new Set(list));
}

function rawNumber(raw: Record<string, unknown>, key: string): number | null {
  const v = raw[key];
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Resolve a BST integer to its community tier label. */
function bstTierLabel(bst: number): string | undefined {
  return BST_TIERS.find((t) => bst >= t.start && bst < t.end)?.label;
}

const BASE_STAT_FIELDS = [
  { key: "pokemonhp", label: "HP" },
  { key: "pokemonattack", label: "Attack" },
  { key: "pokemondefense", label: "Defense" },
  { key: "pokemonspatk", label: "Sp. Atk" },
  { key: "pokemonspdef", label: "Sp. Def" },
  { key: "pokemonspeed", label: "Speed" },
] as const;

/** Blissey's 255 HP is the all-time ceiling — safe max for bar scaling. */
const STAT_BAR_MAX = 255;

function StatRow({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.round((value / STAT_BAR_MAX) * 100));
  return (
    <div className="grid grid-cols-[4.5rem_2.5rem_1fr] items-center gap-2">
      <span className="text-right text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-right text-sm tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
        {value}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <svg
          viewBox="0 0 100 4"
          preserveAspectRatio="none"
          className="block h-2 w-full text-emerald-500 dark:text-emerald-400"
          aria-hidden
        >
          <rect
            width="100"
            height="4"
            className="fill-zinc-100 dark:fill-zinc-800"
            rx="2"
          />
          <rect
            width={pct}
            height="4"
            className="fill-current"
            rx="2"
          />
        </svg>
      </div>
    </div>
  );
}

function BaseStatsSection({ raw }: { raw: Record<string, unknown> }) {
  const statRows = BASE_STAT_FIELDS.map(({ key, label }) => ({
    label,
    value: rawNumber(raw, key),
  }));
  const bst = rawNumber(raw, "pokemonbst");
  const hasAny = bst != null || statRows.some((s) => s.value != null);

  if (!hasAny) return null;

  const tier = bst != null ? bstTierLabel(bst) : undefined;

  return (
    <section
      className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800"
      aria-label="Base stats"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Base Stats
      </h3>
      <div className="flex flex-col gap-1.5">
        {statRows.map(({ label, value }) =>
          value != null ? (
            <StatRow key={label} label={label} value={value} />
          ) : null,
        )}
        {bst != null && (
          <div className="mt-1 grid grid-cols-[4.5rem_auto_1fr] items-center gap-2 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
            <span className="text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Total
            </span>
            <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {bst}
            </span>
            {tier && (
              <span className="ml-1 inline-flex w-fit items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                {tier}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function BackToSearchLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back to search
    </Link>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
      {children}
    </span>
  );
}

function BadgeList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge key={v}>{v}</Badge>
        ))}
      </div>
    </div>
  );
}

function PokemonDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8" aria-busy aria-live="polite">
      <BackToSearchLink />

      <article
        data-region="pokemon-detail-skeleton"
        className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="size-8 animate-spin text-emerald-500"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.2"
                />
                <path
                  d="M21 12a9 9 0 0 1-9 9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="h-7 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex gap-1.5">
                <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex gap-1.5">
                <div className="h-6 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function PokemonNotFound({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <BackToSearchLink />
      <section
        data-region="pokemon-not-found"
        className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pokémon not found
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          No indexed Pokémon matched the slug{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {slug}
          </code>
          .
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          Try a different name from the search results.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            Back to search
          </Link>
        </div>
      </section>
    </div>
  );
}

function PokemonDetailError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <BackToSearchLink />
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">Could not load Pokémon details</p>
        <p className="mt-2 text-sm">{message}</p>
      </section>
    </div>
  );
}

function PokemonDetail({ hit }: { hit: PokemonDetailHit }) {
  const raw = hit.raw;
  const picture =
    (raw.pictureuri as string | undefined) ||
    (raw.picture_uri as string | undefined) ||
    (raw.syspictureuri as string | undefined);
  const types = rawValues(raw, "pokemontype");
  const abilities = rawValues(raw, "pokemonability");
  const generation =
    (raw.pokemongeneration as string | undefined) ||
    (raw.pokemon_generation as string | undefined);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <BackToSearchLink />
      <article
        data-region="pokemon-detail"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-start">
          <div className="h-48 w-48 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            {picture ? (
              <PokemonIndexedImage
                src={picture}
                sizes="192px"
                boxClassName="h-48 w-48 rounded-xl bg-zinc-100 dark:bg-zinc-900"
                imageClassName="object-contain"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                No image
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-5">
            <h1 className="break-words text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {hit.title}
            </h1>

            <BadgeList label="Types" values={types} />
            {generation && (
              <BadgeList label="Generation" values={[generation]} />
            )}
            <BadgeList label="Abilities" values={abilities} />
          </div>
        </div>

        <BaseStatsSection raw={raw} />

        <footer className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Indexed by Coveo from pokemondb.net
          </p>
          <a
            href={hit.clickUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
          >
            View on pokemondb.net
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </footer>
      </article>
    </div>
  );
}

export function PokemonDetailView({ slug }: { slug: string }) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const displaySlug = normalizeSlug(slug) ?? slug;

  // Parent passes `key={slug}` so the component remounts on slug change,
  // giving us a fresh "loading" state without an in-effect setState (which the
  // react-hooks/set-state-in-effect lint flags as cascading renders).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchPokemonBySlug(slug, controller.signal)
      .then((hit) => {
        if (cancelled) return;
        setState(hit ? { status: "found", hit } : { status: "notfound" });
      })
      .catch((err: unknown) => {
        if (cancelled || (err as { name?: string }).name === "AbortError") return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug]);

  if (state.status === "loading") return <PokemonDetailSkeleton />;
  if (state.status === "notfound") return <PokemonNotFound slug={displaySlug} />;
  if (state.status === "error") return <PokemonDetailError message={state.message} />;
  return <PokemonDetail hit={state.hit} />;
}
