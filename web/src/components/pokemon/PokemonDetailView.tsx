"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  fetchPokemonBySlug,
  normalizeSlug,
  type PokemonDetailHit,
} from "@/coveo/fetch-pokemon-by-slug";
import {
  getDetailGeneratedAnswer,
  runDetailRgaNlSearch,
} from "@/coveo/detail-rga-engine";
import { coveoConfigured } from "@/coveo/search-instance";
import { GeneratedAnswerPanel } from "@/components/search/GeneratedAnswerPanel";
import { useCoveoController } from "@/hooks/useCoveoController";
import { PokemonIndexedImage } from "@/components/pokemon/PokemonIndexedImage";
import { PokemonTypePillRow } from "@/components/pokemon/PokemonTypePill";
import { BST_TIERS } from "@/coveo/search-instance";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/layout/Card";
import {
  cleanIndexedPokemonTitle,
  formatNationalDex,
  nationalDexFromRaw,
} from "@/lib/nationalDex";
import {
  formatEvYieldStatLabel,
  formatGrowthRateLabel,
  formatReleaseLabel,
} from "@/lib/pokemonFacetLabels";
import { PokemonSpritePackPanel } from "@/components/pokemon/PokemonSpritePackPanel";
import { spriteAssetBaseUrl } from "@/lib/spriteAsset";

/* ── View state ────────────────────────────────────────────────────────── */

type ViewState =
  | { status: "loading" }
  | { status: "found"; hit: PokemonDetailHit }
  | { status: "notfound" }
  | { status: "error"; message: string };

/* ── Helpers ───────────────────────────────────────────────────────────── */

function rawValues(raw: Record<string, unknown>, key: string): string[] {
  const v = raw[key];
  if (v == null) return [];
  let list: string[];
  if (Array.isArray(v)) {
    list = v.map(String).filter(Boolean);
  } else {
    const s = String(v);
    list = s.includes(";")
      ? s.split(";").map((p) => p.trim()).filter(Boolean)
      : [s];
  }
  return Array.from(new Set(list));
}

function rawNumber(raw: Record<string, unknown>, key: string): number | null {
  const v = raw[key];
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function rawString(raw: Record<string, unknown>, key: string): string | null {
  const v = raw[key];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Coveo keyword `q` for the detail RGA engine — the indexed species title (same
 * as the card heading). Short name-style queries match the dex reliably; long
 * prose was more likely to dilute relevance.
 */
function pokemonDetailRgaSearchQuery(hit: PokemonDetailHit): string {
  return cleanIndexedPokemonTitle(hit.title).trim();
}

function bstTierLabel(bst: number): string | undefined {
  return BST_TIERS.find((t) => bst >= t.start && bst < t.end)?.label;
}

function formatEvYieldList(raw: Record<string, unknown>): string | null {
  const v = raw.pokemonevyield;
  if (v == null) return null;
  const list = Array.isArray(v) ? v.map(String) : [String(v)];
  const friendly = list
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => formatEvYieldStatLabel(s));
  return friendly.length > 0 ? friendly.join(", ") : null;
}

/**
 * Render a metric height (0.7 → "0.7 m") or weight (6.9 → "6.9 kg"). The
 * underlying Coveo fields are `Decimal`, so values arrive as JS numbers; we
 * trim trailing zeros but keep at least one decimal place so "0.7" doesn't
 * become "0" (visual rounding loses a meaningful order of magnitude).
 */
function formatMetricMeasurement(value: number | null, unit: "m" | "kg"): string | null {
  if (value == null) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(1)} ${unit}`;
}

/** Same centered “sheet” and header rhythm as `SearchInterfaceConfigured`. */
function PokedexDetailChrome({
  title,
  metaLine,
  /**
   * Optional secondary heading rendered below the H1 — used for Pokémon that
   * only have non-default canonical forms (e.g. Deoxys → "Normal Forme",
   * Giratina → "Altered Forme"). Sourced from the YAML push's `pokemonform`
   * field via `transform.ts → resolveCanonicalForm`.
   */
  formSubtitle,
  children,
}: {
  title: string;
  metaLine?: ReactNode;
  formSubtitle?: string;
  children: ReactNode;
}) {
  return (
    <AppShell
      maxWidth="full"
      spacing="compact"
      className="max-w-[42rem] bg-white/95 lg:max-w-6xl"
    >
      <div className="flex flex-col gap-5">
        <nav>
          <BackToSearchLink />
        </nav>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Coveo Pokédex
          </p>
          {metaLine != null && (
            <p className="text-[11px] font-medium tabular-nums text-zinc-500">
              {metaLine}
            </p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            {title}
          </h1>
          {formSubtitle && (
            <p className="text-sm font-medium text-zinc-600">{formSubtitle}</p>
          )}
        </header>
        {children}
      </div>
    </AppShell>
  );
}

/* ── Stat bar ──────────────────────────────────────────────────────────── */

const BASE_STAT_FIELDS = [
  { key: "pokemonhp",      label: "HP"      },
  { key: "pokemonattack",  label: "Attack"  },
  { key: "pokemondefense", label: "Defense" },
  { key: "pokemonspatk",   label: "Sp. Atk" },
  { key: "pokemonspdef",   label: "Sp. Def" },
  { key: "pokemonspeed",   label: "Speed"   },
] as const;

const STAT_BAR_MAX = 255;

function StatRow({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.round((value / STAT_BAR_MAX) * 100));
  const fillClass =
    pct >= 70 ? "fill-sky-600" : pct >= 40 ? "fill-sky-500" : "fill-sky-400";

  return (
    <div className="grid grid-cols-[4.5rem_2.5rem_1fr] items-center gap-2">
      <span className="text-right text-xs text-zinc-500">{label}</span>
      <span className="text-right text-sm tabular-nums font-medium text-zinc-950">
        {value}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full">
        <svg
          viewBox="0 0 100 4"
          preserveAspectRatio="none"
          className="block h-2 w-full"
          aria-hidden
        >
          <rect width="100" height="4" className="fill-zinc-200" rx="2" />
          <rect width={pct} height="4" className={fillClass} rx="2" />
        </svg>
      </div>
    </div>
  );
}

function BaseStatsPanel({ raw }: { raw: Record<string, unknown> }) {
  const statRows = BASE_STAT_FIELDS.map(({ key, label }) => ({
    label,
    value: rawNumber(raw, key),
  }));
  const bst = rawNumber(raw, "pokemonbst");
  const hasAny = bst != null || statRows.some((s) => s.value != null);
  if (!hasAny) return null;

  const tier = bst != null ? bstTierLabel(bst) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {statRows.map(({ label, value }) =>
        value != null ? <StatRow key={label} label={label} value={value} /> : null,
      )}
      {bst != null && (
        <div className="mt-1 grid grid-cols-[4.5rem_auto_1fr] items-center gap-2 border-t border-zinc-200 pt-1.5">
          <span className="text-right text-xs font-semibold text-zinc-600">
            Total
          </span>
          <span className="text-sm font-semibold tabular-nums text-zinc-950">
            {bst}
          </span>
          {tier && (
            <span className="ml-1 inline-flex w-fit items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
              {tier}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────────── */

function BackToSearchLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 outline-none hover:text-sky-900 focus-visible:ring-4 focus-visible:ring-sky-500/30"
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
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800">
      {children}
    </span>
  );
}

function BadgeList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
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

function TypesSection({ types }: { types: string[] }) {
  if (types.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Types
      </h3>
      <PokemonTypePillRow types={types} className="justify-start" />
    </div>
  );
}

function PokemonDetailRgaBlock({ hit }: { hit: PokemonDetailHit }) {
  if (!coveoConfigured()) return null;

  const controller = getDetailGeneratedAnswer();
  const state = useCoveoController(controller);
  const searchQuery = pokemonDetailRgaSearchQuery(hit);

  /**
   * Defer `executeSearch` to the next macrotask so React 18 Strict Mode’s
   * setup → cleanup → setup cycle clears the first timer. Otherwise two searches
   * fire back-to-back, Coveo aborts the first, and the console shows
   * `search/executeSearch/rejected` while the RGA panel can flash empty.
   */
  useEffect(() => {
    if (!searchQuery) return;
    let alive = true;
    const t = window.setTimeout(() => {
      if (alive) runDetailRgaNlSearch(searchQuery);
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [hit.uri, searchQuery]);

  const hasGeneratedAnswer =
    Boolean(state.answer?.trim()) ||
    state.isLoading ||
    state.isStreaming ||
    Boolean(state.error?.message);

  if (!hasGeneratedAnswer) return null;
  return <GeneratedAnswerPanel controller={controller} state={state} />;
}

/**
 * Two-column key/value list for the v2 fields added by the YAML push source
 * (height/weight/catch rate/growth rate/release/EV yield). Hides itself when
 * none of the fields are populated, so legacy Web-source documents continue
 * to render without an empty pane.
 */
function ProfileSection({ rows }: { rows: Array<{ label: string; value: string }> }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Profile
      </h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="font-medium text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────────────── */

function PokemonDetailSkeleton() {
  return (
    <PokedexDetailChrome title="Pokémon">
      <div className="flex flex-col gap-4" aria-busy aria-live="polite">
        <Card
          size="lg"
          region="pokemon-detail-skeleton"
          className="border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-md bg-zinc-100">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-200 to-zinc-100" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="size-8 animate-spin text-sky-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    cx="12" cy="12" r="9"
                    stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"
                  />
                  <path
                    d="M21 12a9 9 0 0 1-9 9"
                    stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="h-4 w-48 animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-100" />
              <div className="flex gap-1.5">
                <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-100" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
              </div>
            </div>
          </div>
        </Card>
        <Card
          size="lg"
          region="pokemon-stats-skeleton"
          className="border-zinc-200 bg-zinc-50 shadow-sm"
        >
          <div className="mb-4 h-6 w-24 animate-pulse rounded bg-zinc-200/80" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-zinc-200/70" />
            ))}
          </div>
        </Card>
      </div>
    </PokedexDetailChrome>
  );
}

/* ── Error / not-found states ──────────────────────────────────────────── */

function PokemonNotFound({ slug }: { slug: string }) {
  return (
    <PokedexDetailChrome title="Pokémon not found">
      <Card
        size="lg"
        region="pokemon-not-found"
        className="border-zinc-200 bg-white text-center shadow-sm"
      >
          <h2 className="text-lg font-semibold text-zinc-950">
            No matching species
          </h2>
          <p className="mt-3 text-sm text-zinc-600">
            No indexed Pokémon matched the slug{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
              {slug}
            </code>
            .
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Try a different name from the search results.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              Back to search
            </Link>
          </div>
      </Card>
    </PokedexDetailChrome>
  );
}

function PokemonDetailError({ message }: { message: string }) {
  return (
    <PokedexDetailChrome title="Could not load details">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
          <p className="font-medium">Could not load Pokémon details</p>
          <p className="mt-2 text-sm">{message}</p>
      </div>
    </PokedexDetailChrome>
  );
}

/* ── Detail view ───────────────────────────────────────────────────────── */

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
  const displayTitle = cleanIndexedPokemonTitle(hit.title);
  const nationalDex = nationalDexFromRaw(raw);
  const nationalDexLabel =
    nationalDex != null ? formatNationalDex(nationalDex) : null;
  const bst = rawNumber(raw, "pokemonbst");

  // v2 fields from the YAML push source. Each is optional — older Web-source
  // documents (or future species missing a particular field) just skip the row.
  const species = rawString(raw, "pokemonspecies");
  const formName = rawString(raw, "pokemonform");
  const release = rawString(raw, "pokemonrelease");
  const growthRate = rawString(raw, "pokemongrowthrate");
  const catchRate = rawNumber(raw, "pokemoncatchrate");
  const heightLabel = formatMetricMeasurement(rawNumber(raw, "pokemonheight"), "m");
  const weightLabel = formatMetricMeasurement(rawNumber(raw, "pokemonweight"), "kg");
  const evYieldLabel = formatEvYieldList(raw);

  const hasMetaLine = nationalDexLabel != null || species != null || bst != null;
  const metaLine = hasMetaLine ? (
    <>
      {nationalDexLabel != null && (
        <span className="text-zinc-600">{nationalDexLabel}</span>
      )}
      {nationalDexLabel != null && species && (
        <span className="mx-1.5 text-zinc-300" aria-hidden>
          ·
        </span>
      )}
      {species && (
        <span className="text-zinc-600">{species} Pokémon</span>
      )}
      {(nationalDexLabel != null || species) && bst != null && (
        <span className="mx-1.5 text-zinc-300" aria-hidden>
          ·
        </span>
      )}
      {bst != null && (
        <span
          className="font-semibold text-sky-600"
          aria-label={`Base Stat Total ${bst}`}
        >
          BST {bst}
        </span>
      )}
    </>
  ) : undefined;

  const profileRows: Array<{ label: string; value: string }> = [];
  if (heightLabel && weightLabel) {
    profileRows.push({ label: "Size", value: `${heightLabel} · ${weightLabel}` });
  } else if (heightLabel) {
    profileRows.push({ label: "Height", value: heightLabel });
  } else if (weightLabel) {
    profileRows.push({ label: "Weight", value: weightLabel });
  }
  if (catchRate != null) {
    profileRows.push({ label: "Catch rate", value: String(catchRate) });
  }
  if (growthRate) {
    profileRows.push({ label: "Growth rate", value: formatGrowthRateLabel(growthRate) });
  }
  if (release) {
    profileRows.push({ label: "Debut", value: formatReleaseLabel(release) });
  }
  if (evYieldLabel) {
    profileRows.push({ label: "EV yield", value: evYieldLabel });
  }

  const hasStats =
    rawNumber(raw, "pokemonbst") != null ||
    BASE_STAT_FIELDS.some(({ key }) => rawNumber(raw, key) != null);

  const mainCard = (
    <Card
      variant="default"
      size="lg"
      region="pokemon-detail"
      className="border-zinc-200 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-md bg-zinc-100">
          {picture ? (
            <PokemonIndexedImage
              src={picture}
              sizes="192px"
              boxClassName="h-48 w-48 rounded-md bg-zinc-100"
              imageClassName="object-contain p-2"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <TypesSection types={types} />
          {generation && <BadgeList label="Generation" values={[generation]} />}
          <BadgeList label="Abilities" values={abilities} />
          <ProfileSection rows={profileRows} />
        </div>

        {nationalDex != null && spriteAssetBaseUrl() && (
          <aside
            aria-label="Local sprite assets"
            className="w-full shrink-0 border-t border-zinc-200 pt-6 lg:w-64 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-6 xl:w-72"
          >
            <PokemonSpritePackPanel nationalDex={nationalDex} compact />
          </aside>
        )}
      </div>

      <footer className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          Indexed in Coveo from YAML reference data (pokemondb.net species URLs)
        </p>
        <a
          href={hit.clickUri}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 outline-none hover:text-sky-900 focus-visible:ring-4 focus-visible:ring-sky-500/30"
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
    </Card>
  );

  const statsCard =
    hasStats ? (
      <Card
        variant="default"
        size="lg"
        region="pokemon-stats"
        className="border-zinc-200 bg-zinc-50 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-900">
          Stats
        </h2>
        <BaseStatsPanel raw={raw} />
      </Card>
    ) : null;

  return (
    <PokedexDetailChrome
      title={displayTitle}
      metaLine={metaLine}
      formSubtitle={formName ?? undefined}
    >
      <div className="flex flex-col gap-4">
        {mainCard}
        <PokemonDetailRgaBlock hit={hit} />
        {statsCard}
      </div>
    </PokedexDetailChrome>
  );
}

/* ── Exported view ─────────────────────────────────────────────────────── */

export function PokemonDetailView({ slug }: { slug: string }) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const displaySlug = normalizeSlug(slug) ?? slug;

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
