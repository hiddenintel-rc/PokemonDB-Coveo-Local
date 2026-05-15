import type { NextConfig } from "next";

function spriteAssetRemotePattern():
  | { protocol: "http" | "https"; hostname: string; port?: string; pathname: string }
  | undefined {
  const raw = process.env.NEXT_PUBLIC_SPRITE_ASSET_BASE_URL?.trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return {
      protocol: u.protocol === "https:" ? "https" : "http",
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname: "/**",
    };
  } catch {
    return undefined;
  }
}

const spritePattern = spriteAssetRemotePattern();

/** Default local sprite static host (see `tools/local-sprite-server`). */
const DEV_SPRITE_REMOTE_PATTERN = {
  protocol: "http" as const,
  hostname: "127.0.0.1",
  port: "8787",
  pathname: "/**",
};

function isSameRemotePattern(
  a: { protocol: string; hostname: string; port?: string; pathname: string },
  b: typeof DEV_SPRITE_REMOTE_PATTERN,
): boolean {
  return (
    a.protocol === b.protocol &&
    a.hostname === b.hostname &&
    (a.port ?? "") === (b.port ?? "") &&
    a.pathname === b.pathname
  );
}

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.pokemondb.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.pokemondb.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.cloud.coveo.com",
        pathname: "/**",
      },
      // `next.config` is evaluated before `.env.local` is always visible here; hard-code
      // the usual local sprite port so `next/image` works without a full dev-server restart dance.
      ...(process.env.NODE_ENV === "development" ? [DEV_SPRITE_REMOTE_PATTERN] : []),
      ...(spritePattern &&
      !(
        process.env.NODE_ENV === "development" &&
        isSameRemotePattern(spritePattern, DEV_SPRITE_REMOTE_PATTERN)
      )
        ? [spritePattern]
        : []),
    ],
  },
  async headers() {
    return [
      {
        // Apply to every route (including static chunks under `/_next/`).
        source: "/(.*)",
        headers: [
          // Prevent this page from being embedded in an <iframe> on another origin.
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers from MIME-sniffing the content-type of responses.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the full origin on same-origin requests; only the origin (no path) on cross-origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict access to browser features this app never needs.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Do not issue DNS prefetch hints for third-party origins linked on the page.
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
