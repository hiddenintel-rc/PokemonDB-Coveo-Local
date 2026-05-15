"use client";

import Image from "next/image";
import { isSpriteAssetUrl } from "@/lib/spriteAsset";

function isIndexedPokemonImageUrl(src: string): boolean {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    const { hostname } = u;
    if (hostname === "img.pokemondb.net" || hostname === "www.pokemondb.net")
      return true;
    if (hostname.endsWith(".cloud.coveo.com")) return true;
    return false;
  } catch {
    return false;
  }
}

function isAllowedPokemonImageUrl(src: string): boolean {
  return isIndexedPokemonImageUrl(src) || isSpriteAssetUrl(src);
}

type PokemonIndexedImageProps = {
  src: string;
  /** e.g. `"96px"` for cards, `"192px"` for detail hero */
  sizes: string;
  /** Outer box must be `position: relative` with fixed dimensions for `fill` */
  boxClassName: string;
  imageClassName: string;
  priority?: boolean;
};

/**
 * Renders artwork from known HTTPS hosts (pokemondb + Coveo `*.cloud.coveo.com`) via
 * `next/image`, or from the configured sprite base with a native `<img>` (avoids ORB
 * issues some browsers apply to cross-origin `next/image` loads behind tunnels/CDNs).
 */
export function PokemonIndexedImage({
  src,
  sizes,
  boxClassName,
  imageClassName,
  priority,
}: PokemonIndexedImageProps) {
  if (!isAllowedPokemonImageUrl(src)) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-zinc-400 ${boxClassName}`}
      >
        No image
      </div>
    );
  }

  if (isSpriteAssetUrl(src)) {
    return (
      <div className={`relative overflow-hidden ${boxClassName}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          {...(priority ? { fetchPriority: "high" as const } : {})}
          className={`absolute inset-0 h-full w-full ${imageClassName}`}
        />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${boxClassName}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className={imageClassName}
        priority={priority}
      />
    </div>
  );
}
