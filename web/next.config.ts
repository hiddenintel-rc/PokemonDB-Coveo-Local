import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route.
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
        ],
      },
    ];
  },
};

export default nextConfig;
