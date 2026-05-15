/**
 * Build absolute URLs for the PokeAPI/sprites `sprites/pokemon/` layout
 * (see `docs/sprite-assets-local-handoff.md`).
 */

const MAX_DEX = 99999;

function trimBase(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

function stripTrailingSlash(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function isUnderBase(src: string, base: string | null): boolean {
  if (!base) return false;
  try {
    const u = new URL(src);
    const b = new URL(base);
    if (u.origin !== b.origin) return false;
    const basePath = b.pathname.replace(/\/+$/, "");
    if (basePath) {
      return u.pathname === basePath || u.pathname.startsWith(`${basePath}/`);
    }
    return u.pathname.startsWith("/pokemon/");
  } catch {
    return false;
  }
}

/** Public env read by Next at build time for the static sprite origin (e.g. tunnel or localhost). */
export function spriteAssetBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SPRITE_ASSET_BASE_URL?.trim();
  return v ?? "";
}

/**
 * Optional mirror (e.g. public PokeAPI sprites tree). When set alongside the primary,
 * the sprite pack retries these URLs after the primary fails (502, missing file).
 */
export function spriteFallbackBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SPRITE_FALLBACK_ASSET_BASE_URL?.trim();
  return v ?? "";
}

/** Base URL with trailing slash removed (path-join friendly). */
export function normalizedSpriteAssetBase(): string | null {
  return trimBase(spriteAssetBaseUrl());
}

export function normalizedSpriteFallbackBase(): string | null {
  return trimBase(spriteFallbackBaseUrl());
}

/** Show the Sprites panel when either primary or fallback base is configured. */
export function spritePackUiEnabled(): boolean {
  return normalizedSpriteAssetBase() != null || normalizedSpriteFallbackBase() != null;
}

/**
 * True only when `src` is under the configured primary sprite base (prevents open redirects).
 */
export function isSpriteAssetUrl(src: string): boolean {
  return isUnderBase(src, normalizedSpriteAssetBase());
}

/** True when `src` is under the primary or optional fallback sprite base. */
export function isConfiguredSpriteHostUrl(src: string): boolean {
  return (
    isUnderBase(src, normalizedSpriteAssetBase()) ||
    isUnderBase(src, normalizedSpriteFallbackBase())
  );
}

export type SpritePackUrls = {
  defaultSprite: string;
  officialArtwork: string;
  home: string;
  showdownGif: string;
};

export type SpriteSource = { primary: string; fallback?: string };

export type SpritePackSources = {
  defaultSprite: SpriteSource;
  officialArtwork: SpriteSource;
  home: SpriteSource;
  showdownGif: SpriteSource;
};

export function buildSpritePackSources(nationalDex: number): SpritePackSources | null {
  if (!Number.isFinite(nationalDex) || nationalDex < 1 || nationalDex > MAX_DEX)
    return null;
  const primaryBase = normalizedSpriteAssetBase();
  const mirrorBase = normalizedSpriteFallbackBase();
  if (!primaryBase && !mirrorBase) return null;

  const primaryRoot = stripTrailingSlash(primaryBase ?? mirrorBase!);
  const mirrorRootRaw =
    primaryBase && mirrorBase && stripTrailingSlash(mirrorBase) !== primaryRoot
      ? stripTrailingSlash(mirrorBase)
      : undefined;

  const n = String(Math.trunc(nationalDex));
  const rel = {
    defaultSprite: `/pokemon/${n}.png`,
    officialArtwork: `/pokemon/other/official-artwork/${n}.png`,
    home: `/pokemon/other/home/${n}.png`,
    showdownGif: `/pokemon/other/showdown/${n}.gif`,
  } as const;

  function pair(key: keyof typeof rel): SpriteSource {
    const r = rel[key];
    return {
      primary: `${primaryRoot}${r}`,
      ...(mirrorRootRaw ? { fallback: `${mirrorRootRaw}${r}` } : {}),
    };
  }

  return {
    defaultSprite: pair("defaultSprite"),
    officialArtwork: pair("officialArtwork"),
    home: pair("home"),
    showdownGif: pair("showdownGif"),
  };
}

/** Primary-tier URLs only (no mirror); null if no primary base. */
export function buildSpritePackUrls(nationalDex: number): SpritePackUrls | null {
  if (!Number.isFinite(nationalDex) || nationalDex < 1 || nationalDex > MAX_DEX)
    return null;
  const base = normalizedSpriteAssetBase();
  if (!base) return null;
  const root = stripTrailingSlash(base);
  const n = String(Math.trunc(nationalDex));
  return {
    defaultSprite: `${root}/pokemon/${n}.png`,
    officialArtwork: `${root}/pokemon/other/official-artwork/${n}.png`,
    home: `${root}/pokemon/other/home/${n}.png`,
    showdownGif: `${root}/pokemon/other/showdown/${n}.gif`,
  };
}
