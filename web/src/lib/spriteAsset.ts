/**
 * Build absolute URLs for the PokeAPI/sprites `sprites/pokemon/` layout
 * (see `docs/sprite-assets-local-handoff.md`).
 */

const MAX_DEX = 99999;

/** Public env read by Next at build time for the static sprite origin (e.g. tunnel or localhost). */
export function spriteAssetBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SPRITE_ASSET_BASE_URL?.trim();
  return v ?? "";
}

/** Base URL with trailing slash removed (path-join friendly). */
export function normalizedSpriteAssetBase(): string | null {
  const raw = spriteAssetBaseUrl();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

/**
 * True only when `src` is under the configured sprite base (prevents open redirects).
 */
export function isSpriteAssetUrl(src: string): boolean {
  const base = normalizedSpriteAssetBase();
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

export type SpritePackUrls = {
  defaultSprite: string;
  officialArtwork: string;
  home: string;
  showdownGif: string;
};

export function buildSpritePackUrls(nationalDex: number): SpritePackUrls | null {
  if (!Number.isFinite(nationalDex) || nationalDex < 1 || nationalDex > MAX_DEX)
    return null;
  const base = normalizedSpriteAssetBase();
  if (!base) return null;
  const root = base.endsWith("/") ? base.slice(0, -1) : base;
  const n = String(Math.trunc(nationalDex));
  return {
    defaultSprite: `${root}/pokemon/${n}.png`,
    officialArtwork: `${root}/pokemon/other/official-artwork/${n}.png`,
    home: `${root}/pokemon/other/home/${n}.png`,
    showdownGif: `${root}/pokemon/other/showdown/${n}.gif`,
  };
}
