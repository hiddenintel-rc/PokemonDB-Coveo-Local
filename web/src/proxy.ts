import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Per-request CSP nonce for script/style tags Next.js and React emit.
 * @see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/**
 * Coveo endpoints for Search + Usage Analytics (legacy UA) + ML training signals.
 *
 * Headless is pinned to `analyticsMode: 'legacy'` (see `search-instance.ts`), so browser
 * traffic includes POSTs to **Usage Analytics** (`…/rest/ua/…` on regional `analytics*.cloud.coveo.com`)
 * for: `search`, `searchQuerySuggest`, `facetSelect`, `documentClick` (ART), `genqa.*` (RGA), etc.
 *
 * - `https://*.cloud.coveo.com` — covers US/EU/APAC platform + analytics hostnames (e.g. `analytics-au.cloud.coveo.com`).
 * - `https://*.org.coveo.com` — **Search API** host pattern Headless uses (`{organizationId}.org.coveo.com/rest/search/v2`).
 *   Without this, the browser blocks search with CSP and Headless reports `Disconnected` / statusCode 0.
 * - `wss://*.cloud.coveo.com` — **connect-src** applies to WebSockets separately; RGA / streaming may use `wss:` to the platform.
 * - Explicit US/EU analytics + `static.cloud.coveo.com` — belt-and-suspenders for analytics connectivity and older hard-coded clients.
 *
 * If the Admin Console shows a different region host after a migration, add it here (or rely on `*.cloud.coveo.com` if it matches).
 */
function contentSecurityPolicy(n: string): string {
  const isDev = process.env.NODE_ENV === "development";

  const coveoConnect =
    "https://*.cloud.coveo.com " +
    "https://*.org.coveo.com " +
    "wss://*.cloud.coveo.com " +
    "https://platform.cloud.coveo.com " +
    "https://platform-eu.cloud.coveo.com " +
    "https://analytics.cloud.coveo.com " +
    "https://analytics-eu.cloud.coveo.com " +
    "https://analytics-au.cloud.coveo.com " +
    "https://static.cloud.coveo.com";

  // In dev mode, Next.js (Turbopack) and React use eval() for source-map
  // reconstruction, HMR, and callstack debugging. 'unsafe-eval' is required
  // locally or the browser blocks the runtime entirely. It is never emitted
  // in production (NODE_ENV === 'production'), so the live Vercel deployment
  // keeps the strict CSP with no eval() permitted.
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${n}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${n}' 'strict-dynamic'`;

  const directives = [
    "default-src 'self'",
    scriptSrc,
    `style-src 'self' 'nonce-${n}'`,
    "img-src 'self' data: blob: https://img.pokemondb.net https://www.pokemondb.net https://*.cloud.coveo.com",
    "font-src 'self' data:",
    `connect-src 'self' ${coveoConnect}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

/** Next.js 16+ file convention (replaces `middleware.ts`). Same Edge behavior and `config.matcher`. */
export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|ico|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
