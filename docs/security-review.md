# Security review — web application (`web/`)

**Scope:** Next.js app under `web/` as deployed to Vercel (and local `npm run dev`). Coveo Cloud org configuration is out of scope for code review but referenced where credentials meet the platform.

**Last reviewed:** 2026-05-13 (documentation + code pass: network surfaces, secrets hygiene, CSP proxy naming).

---

## 1. Clarification: Vercel and “hiding” API tokens

Variables named `NEXT_PUBLIC_*` are **inlined at build time** into the JavaScript bundle the browser downloads. **Vercel does not keep them secret from visitors** — anyone with the deployed site can inspect built assets or the Network tab and see values the client must send (e.g. Coveo org id, Anonymous Search API key).

That is **by design** for anonymous, browser-side search over **public** index content. It is **not** a substitute for server-side secrets. See **DD-3** in [design-decisions.md](./design-decisions.md). A later hardening step is **search tokens** minted by **your** backend (not implemented in this repo).

---

## 2. “Backend” in this codebase

There is **no application-owned API backend** under `web/` today:

| Surface | Present? |
|---------|----------|
| `app/api/**/route.ts` (Route Handlers) | **No** |
| `"use server"` / Server Actions | **No** |
| **`src/proxy.ts`** | **Yes** — Next.js **16+** Edge convention (replaces root `middleware.ts`): **Content-Security-Policy** with a per-request nonce and **`x-nonce`** forwarded to the root layout (not business-logic APIs). |

What **does** run on the server (Vercel / Node):

- **Next.js** serves HTML, RSC payloads, and static chunks for App Router routes.
- **`next.config.ts`** applies [HTTP security headers](./design-decisions.md) (**DD-14**) to **all** responses (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`).

All **Coveo Search API** calls (`@coveo/headless` engine + `fetch-pokemon-by-slug.ts`) execute **in the browser** with the Bearer token from `NEXT_PUBLIC_COVEO_API_KEY`.

So: **server-side security** here means **Next config + proxy CSP + absence of accidental server secrets + safe client patterns**, not a separate REST backend.

**Network / sensitive data (re-audit):** The Anonymous Search key is sent only on Coveo **Search** (`…/rest/search/v2` and org-specific hosts Headless chooses) and **Usage Analytics** / ML traffic allowed by CSP — same as documented in §1. There is **no** app `console.*` logging of env or tokens under `web/src/`. `preprocessRequest` in `search-instance.ts` mutates JSON bodies (source `cq`, wildcard `q`) but does not log them. **Push API** credentials for any local Coveo Push CLI stay in a **gitignored** `.env` (never commit). Root `.gitignore` pattern `.env` matches env files under ignored tool paths.

---

## 3. Findings — **pass**

| Topic | Evidence |
|-------|----------|
| **Secrets in git** | `web/.gitignore` ignores `.env` / `.env.local`; repo root `.gitignore` ignores `.env` anywhere and **`tools/seed-ml/`** + **`tools/push-yaml/`** whole trees; `web/.env.example` has placeholders only. |
| **XSS via HTML injection** | No `dangerouslySetInnerHTML` in components; RGA answer is rendered as **plain text** (see comment in `SearchInterface.tsx`). |
| **Tabnabbing / referrer leak** | `target="_blank"` links use `rel="noreferrer"` (`SearchInterface.tsx`, `PokemonDetailView.tsx`). |
| **Detail-route query injection** | `normalizeSlug()` restricts slugs to `^[a-z0-9-]+$`; invalid slugs short-circuit before building Coveo `aq` (`fetch-pokemon-by-slug.ts`). |
| **Clickjacking / MIME sniffing** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` (`next.config.ts`). |
| **CSP (nonce-based)** | `src/proxy.ts` sets policy; `app/layout.tsx` passes **`nonce`** to `<html>`; stat bars use **SVG** widths (no inline `style`). **`connect-src`** includes `https://*.cloud.coveo.com`, **`wss://*.cloud.coveo.com`**, explicit `analytics*` / `platform*` / **AU** analytics, and **`static.cloud.coveo.com`** so **legacy UA** (search, QS, facets, `documentClick` / ART, RGA / genqa events) and any **WebSocket** streaming are not blocked. |
| **Image surface** | **`PokemonIndexedImage`** + **`next/image`** + **`images.remotePatterns`** — only allowlisted HTTPS hosts; unknown URLs → placeholder (no raw `<img>` fallback to random hosts). |
| **Dependency footprint** | Minimal set: `next`, `react`, `@coveo/headless`, `tailwind` toolchain. |

---

## 4. Findings — **follow-up**

| Topic | Risk | Notes |
|-------|------|--------|
| **Public Anonymous Search key** | Quota abuse, scraping at search API | Acceptable for public demo **only** if key is scoped to search on public sources; mitigate with **search tokens** (**DD-3**). |
| **New artwork hostnames** | Image placeholder until config updated | If Content Browser shows `pictureuri` on a host not under pokemondb / `*.cloud.coveo.com`, add it to **`PokemonIndexedImage`**, **`next.config` `remotePatterns`**, and CSP **`img-src`** together. |
| **Dependency advisories** | Transitive issues (e.g. build-time tooling) | Run `npm audit` in `web/` periodically; avoid `npm audit fix --force` without reading Next.js compatibility (**DD-14**). |
| **Next.js proxy convention** | Naming clarity | Next **16.2** renamed **`middleware.ts`** to **`proxy.ts`** (same Edge behavior). This repo uses **`src/proxy.ts`**. |

---

## 5. Vercel / GitHub hygiene

- **Environment variables:** Keep production keys in Vercel **Production**; use separate Preview values if forks could expose previews.
- **Repository:** Do not commit `.env.local` or real keys; rotate any key that has appeared in a ticket, screenshot, or chat.
- **Custom domains:** When added, confirm HTTPS and that no mixed-content warnings weaken guarantees for Coveo calls.

---

## 6. When you add a real backend

If you introduce Route Handlers, Edge proxy logic, or an external API:

- **Never** prefix server-only secrets with `NEXT_PUBLIC_`.
- Prefer **short-lived search tokens** over long-lived API keys in the browser.
- Revisit **CSP** (`connect-src` for your API origin) and **CORS** explicitly.

---

## Related documentation

- [design-decisions.md](./design-decisions.md) — **DD-3** (client credentials), **DD-14** (headers + CSP + `next/image`).
- [owasp-deployment-review.md](./owasp-deployment-review.md) — **OWASP Top 10:2021** deployment validation and `npm audit` findings.
- Root [README.md](../README.md) — env setup and [Deployment (GitHub → Vercel)](../README.md#deployment-github--vercel).
