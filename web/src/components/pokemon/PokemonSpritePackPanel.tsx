"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type JSX } from "react";
import {
  buildSpritePackSources,
  isConfiguredSpriteHostUrl,
  spritePackUiEnabled,
  type SpriteSource,
} from "@/lib/spriteAsset";

function HostedStillTile({
  label,
  source,
  sizes,
  compact,
}: {
  label: string;
  source: SpriteSource;
  sizes: string;
  compact?: boolean;
}): JSX.Element | null {
  const [src, setSrc] = useState(source.primary);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setSrc(source.primary);
    setHidden(false);
  }, [source.primary, source.fallback]);

  const onError = useCallback(() => {
    if (source.fallback && src === source.primary) {
      setSrc(source.fallback);
      return;
    }
    setHidden(true);
  }, [source, src]);

  if (hidden || !isConfiguredSpriteHostUrl(src)) return null;

  const box =
    compact
      ? "relative size-20 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 sm:size-24"
      : "relative size-28 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 sm:size-32";

  return (
    <div className={`flex flex-col gap-1.5 ${compact ? "items-start" : "items-center"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <div className={box}>
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          className="object-contain p-1"
          onError={onError}
          unoptimized
        />
      </div>
    </div>
  );
}

function HostedGifTile({
  source,
  compact,
}: {
  source: SpriteSource;
  compact?: boolean;
}): JSX.Element | null {
  const [src, setSrc] = useState(source.primary);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setSrc(source.primary);
    setHidden(false);
  }, [source.primary, source.fallback]);

  const onError = useCallback(() => {
    if (source.fallback && src === source.primary) {
      setSrc(source.fallback);
      return;
    }
    setHidden(true);
  }, [source, src]);

  if (hidden || !isConfiguredSpriteHostUrl(src)) return null;

  return (
    <div
      className={
        compact
          ? "mt-1 flex flex-col gap-1.5 border-t border-zinc-100 pt-3"
          : "mt-6 flex flex-col items-center gap-1.5 sm:items-start"
      }
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Battle (animated)
      </span>
      {/* GIF: next/image would flatten animation — native img preserves frames */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={compact ? "max-h-28 w-auto object-contain" : "max-h-40 w-auto object-contain"}
        onError={onError}
      />
    </div>
  );
}

/**
 * Sprites: three still PNGs (next/image) + one animated GIF (native img).
 * Renders null when no sprite base env is set.
 *
 * If `NEXT_PUBLIC_SPRITE_FALLBACK_ASSET_BASE_URL` is set (same path layout as PokeAPI
 * `sprites/`), stills and GIF retry that origin when the primary (e.g. tunnel) fails.
 *
 * **`compact`** — embed beside profile data (narrow column); omit outer card chrome.
 */
export function PokemonSpritePackPanel({
  nationalDex,
  compact = false,
}: {
  nationalDex: number;
  compact?: boolean;
}): JSX.Element | null {
  if (!spritePackUiEnabled()) return null;

  const sources = buildSpritePackSources(nationalDex);
  if (!sources) return null;

  const stillSizes = compact ? "96px" : "128px";

  return (
    <section
      data-region="pokemon-sprite-pack"
      className={
        compact
          ? "flex min-w-0 flex-col gap-3"
          : "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      }
    >
      <h2
        className={
          compact
            ? "text-sm font-semibold tracking-tight text-zinc-900"
            : "mb-4 text-lg font-semibold tracking-tight text-zinc-900"
        }
      >
        Sprites
      </h2>
      {!compact && (
        <p className="mb-4 text-xs text-zinc-500">
          Local or tunneled assets (PokeAPI/sprites layout). Optional public mirror when
          primary host errors. Tiles hide if no URL loads.
        </p>
      )}
      <div
        className={
          compact
            ? "flex flex-col gap-3"
            : "flex flex-wrap items-end justify-center gap-6 sm:justify-start"
        }
      >
        <HostedStillTile
          label="Official"
          source={sources.officialArtwork}
          sizes={stillSizes}
          compact={compact}
        />
        <HostedStillTile label="Home" source={sources.home} sizes={stillSizes} compact={compact} />
        <HostedStillTile
          label="Classic"
          source={sources.defaultSprite}
          sizes={stillSizes}
          compact={compact}
        />
      </div>
      <HostedGifTile source={sources.showdownGif} compact={compact} />
    </section>
  );
}
