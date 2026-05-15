"use client";

import Image from "next/image";
import { isConfiguredSpriteHostUrl } from "@/lib/spriteAsset";

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
  return isIndexedPokemonImageUrl(src) || isConfiguredSpriteHostUrl(src);
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
 * Renders artwork from known HTTPS hosts (pokemondb + Coveo `*.cloud.coveo.com`)
 * or from configured sprite bases (`NEXT_PUBLIC_SPRITE_ASSET_BASE_URL` /
 * `NEXT_PUBLIC_SPRITE_FALLBACK_ASSET_BASE_URL`) via `next/image`.
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

  const sprite = isConfiguredSpriteHostUrl(src);

  return (
    <div className={`relative overflow-hidden ${boxClassName}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className={imageClassName}
        priority={priority}
        // Sprite host is often behind Cloudflare Tunnel; Vercel's image optimizer
        // fetches from a datacenter IP and can get 502 (bot/WAF). Browser loads are fine.
        unoptimized={sprite}
      />
    </div>
  );
}
