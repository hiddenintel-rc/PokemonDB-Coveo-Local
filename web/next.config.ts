import type { NextConfig } from "next";

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
