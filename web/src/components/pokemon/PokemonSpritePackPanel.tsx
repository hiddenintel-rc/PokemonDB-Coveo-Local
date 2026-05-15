"use client";

import Image from "next/image";
import { useCallback, useState, type JSX } from "react";
import {
  buildSpritePackUrls,
  isSpriteAssetUrl,
  spriteAssetBaseUrl,
} from "@/lib/spriteAsset";

function HostedStillTile({
  label,
  src,
  sizes,
  compact,
}: {
  label: string;
  src: string;
  sizes: string;
  compact?: boolean;
}): JSX.Element | null {
  const [hidden, setHidden] = useState(false);
  const onError = useCallback(() => setHidden(true), []);

  if (hidden || !isSpriteAssetUrl(src)) return null;

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

/**
 * Sprites: three still PNGs (next/image) + one animated GIF (native img).
 * Renders null when `NEXT_PUBLIC_SPRITE_ASSET_BASE_URL` is unset.
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
  if (!spriteAssetBaseUrl()) return null;

  const urls = buildSpritePackUrls(nationalDex);
  if (!urls) return null;

  const [gifHidden, setGifHidden] = useState(false);
  const gifSrc = urls.showdownGif;

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
          Local assets (PokeAPI/sprites layout). Tiles hide if a file is missing.
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
          src={urls.officialArtwork}
          sizes={stillSizes}
          compact={compact}
        />
        <HostedStillTile label="Home" src={urls.home} sizes={stillSizes} compact={compact} />
        <HostedStillTile
          label="Classic"
          src={urls.defaultSprite}
          sizes={stillSizes}
          compact={compact}
        />
      </div>
      {!gifHidden && isSpriteAssetUrl(gifSrc) && (
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
            src={gifSrc}
            alt=""
            className={compact ? "max-h-28 w-auto object-contain" : "max-h-40 w-auto object-contain"}
            onError={() => setGifHidden(true)}
          />
        </div>
      )}
    </section>
  );
}
