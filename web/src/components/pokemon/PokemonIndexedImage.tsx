"use client";

import Image from "next/image";

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
 * Renders artwork from known HTTPS hosts (pokemondb + Coveo `*.cloud.coveo.com`) via `next/image`.
 * Other URLs are rejected (no raw `<img>`) so CSP `img-src` can stay tight.
 */
export function PokemonIndexedImage({
  src,
  sizes,
  boxClassName,
  imageClassName,
  priority,
}: PokemonIndexedImageProps) {
  if (!isIndexedPokemonImageUrl(src)) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-zinc-400 ${boxClassName}`}
      >
        No image
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
