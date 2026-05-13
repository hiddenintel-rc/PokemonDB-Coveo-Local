# OWASP-aligned deployment review

This document maps the **`web/`** app (Vercel + Coveo Headless, public search) to **[OWASP Top 10:2021](https://owasp.org/www-project-top-ten/)** categories. It is a **point-in-time validation** against common classes of vulnerability—not a penetration test or formal audit.

**Related:** [security-review.md](./security-review.md) (CSP, headers, secrets), [design-decisions.md](./design-decisions.md) **DD-3**, **DD-14**.

---

## Summary

| Risk area | Posture (short) |
|-----------|-----------------|
| **A01** Broken Access Control | Public read-only app; Coveo key must stay **search-only** in Admin. |
| **A02** Cryptographic Failures | TLS via host; CSP `upgrade-insecure-requests`; no secrets in git. |
| **A03** Injection | Coveo `aq` uses **validated slug**; React text nodes; CSP defense-in-depth. |
| **A04** Insecure Design | Anonymous browser key accepted trade-off; **search tokens** deferred (**DD-3**). |
| **A05** Security Misconfiguration | CSP (nonce) + HTTP headers; Vercel **root = `web`**, Framework **Next.js**. |
| **A06** Vulnerable / outdated components | **`npm audit`**: transitive **PostCSS** in Next—do **not** `audit fix --force`; track Next patches. |
| **A07** Identification & Authentication Failures | **N/A** (no app login); org/API key is the only “identity.” |
| **A08** Software & data integrity failures | Lockfile + pinned majors; no unsigned dynamic includes. |
| **A09** Security logging & monitoring failures | **Coveo UA** carries client events; no first-party SIEM in app. |
| **A10** Server-Side Request Forgery (SSRF) | **Low**—no server route that fetches user-supplied URLs; browser → Coveo only. |

---

## A01:2021 — Broken Access Control

**Applicability:** Medium (API key is the “gate”; no multi-user RBAC in the UI).

**Current controls**

- App is **public search** only—no privileged screens in this repo.
- **Coveo Anonymous Search** template must be enforced in **Admin Console** (search-only, correct hub, no write/admin APIs).

**Gaps / actions**

- **Key scope:** If the key were ever upgraded to a broader template, the same browser exposure becomes a serious access-control failure. **Rotate** and use **search tokens** when moving beyond a demo (**DD-3**).
- **Indexed content:** Access control is effectively “who can hit Search API with the key”—treat as **public** data.

---

## A02:2021 — Cryptographic Failures

**Current controls**

- **Vercel** serves the app over **HTTPS**.
- CSP includes **`upgrade-insecure-requests`** ([middleware](../web/src/middleware.ts)).
- **`.env*`** gitignored; no PEM material in repo.

**Gaps / actions**

- **`NEXT_PUBLIC_*`** values are **not encrypted from the user**—they are public to the client by design. Do not place confidential data there.
- Ensure **TLS** on any custom domain (Vercel default + HSTS at platform edge where applicable).

---

## A03:2021 — Injection

**Subtypes considered:** XSS (stored/reflected in UI), injection into Coveo query language, command injection.

**Current controls**

- **Coveo filter:** `normalizeSlug()` restricts URL slugs to `^[a-z0-9-]+$` before building `@uri==(...)` in [`fetch-pokemon-by-slug.ts`](../web/src/coveo/fetch-pokemon-by-slug.ts).
- **Headless** builds search requests from controlled controller APIs (not raw string concatenation from URL).
- **RGA** answer rendered as **plain text** (no `dangerouslySetInnerHTML`).
- **CSP:** nonce-based **`script-src`** / **`style-src`**, tight **`img-src`**, allowlisted **`connect-src`** for Coveo ([middleware](../web/src/middleware.ts)).

**Gaps / actions**

- **Citations / external links:** `href` comes from **Coveo hit fields** (`clickUri` / `uri`)—if the index were poisoned, users could be sent to malicious sites. Mitigations: **index trust**, `rel="noreferrer"` on `target="_blank"`, CSP does not replace **content curation** in the index.
- **Query text:** User search text is sent to Coveo as designed; rely on Coveo’s server-side handling—no extra escaping in this repo beyond React’s default for *display* of query strings (verify if any `dangerouslySetInnerHTML` is ever added).

---

## A04:2021 — Insecure Design

**Current controls**

- **Threat model** documented: public index, anonymous key, client-side engine (**DD-3**, **DD-14**).
- **Detail fetch** disables analytics so navigation does not double-count as a search (**DD-12**).

**Gaps / actions**

- **Quota / abuse:** Anyone can use the embedded key for **search volume** against the org. Mitigations: **rate limits** (Coveo/org policies), **search tokens** + backend throttling, or IP rules—not implemented in static hosting alone.
- **Privacy:** Search queries leave the browser to Coveo—acceptable for this challenge; document for enterprise reviewers.

---

## A05:2021 — Security Misconfiguration

**Current controls**

- **CSP** + per-request nonce; **`frame-ancestors 'none'`**, **`object-src 'none'`**, **`base-uri 'self'`**, **`form-action 'self'`** ([middleware](../web/src/middleware.ts)).
- **`next.config.ts`:** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`.
- **Vercel:** Root **`web`**, Framework **Next.js**, LTS **Node** (see root [README](../README.md#deployment-github--vercel)).

**Gaps / actions**

- **Preview deployments:** If env vars are weaker, previews can leak behavior—scope **Preview** env in Vercel intentionally.
- **`middleware` → `proxy`:** Next **16.2** may deprecate the middleware file name—track [Next.js](https://github.com/vercel/next.js/releases) so security headers are not dropped during migration.

---

## A06:2021 — Vulnerable and outdated components

**Validation run:** `npm audit` in `web/` (2026-05).

**Finding**

| Package | Advisory | Severity | Notes |
|---------|----------|----------|--------|
| `postcss` (via `next`) | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | Moderate | **CSS stringify XSS** in PostCSS when attacker-controlled CSS is stringified. Next bundles PostCSS for **build-time** CSS processing—not for runtime user CSS in this app. |

**Action**

- **Do not** run `npm audit fix --force` (would pin incompatible **Next** versions per audit output).
- **Upgrade Next.js** when a release includes a patched transitive PostCSS (check release notes periodically).

---

## A07:2021 — Identification and authentication failures

**Applicability:** **Low**—no first-party user accounts or sessions in `web/`.

**Note**

- “Authentication” is effectively the **Coveo API key** in the browser. Treat key **template** and **rotation** as identity controls in Admin.

---

## A08:2021 — Software and data integrity failures

**Current controls**

- **`package-lock.json`** committed for reproducible installs.
- Dependencies limited to **Next**, **React**, **Headless**, **Tailwind** toolchain—small surface.

**Gaps / actions**

- Enable **Dependabot** / **Renovate** on the GitHub repo for PR-based upgrades.
- After upgrades, run **`npm run build`**, **`npm run lint`**, and smoke the hosted app (e.g. [`tools/seed-ml` smoke](../tools/seed-ml/) against staging URL).

---

## A09:2021 — Security logging and monitoring failures

**Current controls**

- **Coveo Usage Analytics** (legacy mode) receives search, facet, click, and genqa-related events for **ML** and dashboards.

**Gaps / actions**

- No **application-owned** security event log (failed auth, CSP violations)—optional improvements:
  - **`report-uri` / `report-to`** on CSP for violation reports to an endpoint or third-party collector.
  - Vercel **Analytics / logs** for 5xx and abuse patterns.

---

## A10:2021 — Server-side request forgery (SSRF)

**Applicability:** **Low** for this codebase.

**Rationale**

- There are **no** `app/api/**` Route Handlers that accept a URL and `fetch` it server-side.
- **`fetchPokemonBySlug`** runs in the **browser** and posts to a **fixed** Coveo Search endpoint; the only variable part is the **JSON body** (slug already validated).

**Residual**

- If you later add a **“preview URL”** or **webhook proxy** API route, apply URL allowlists and block private IP ranges by design.

---

## SSRF (2021 list) / client-side “open redirect” notes

- **Open redirect:** Internal routes use **`/pokemon/${slug}`** with `slug` from **validated** `normalizeSlug` path or from Coveo `clickUri` parsing—avoid introducing `?redirect=` query params without validation.
- **Tabnabbing:** External links use **`rel="noreferrer"`** with **`target="_blank"`**.

---

## Deployment checklist (OWASP-oriented)

1. **Coveo Admin:** Anonymous key = **search-only**; correct **search hub**; no admin/write templates in the client.
2. **Vercel:** Production env vars set; **Node LTS**; root **`web`** + **Next.js** preset.
3. **Post-deploy:** Browser **DevTools** → Console for **CSP violations**; Network for **failed** `analytics` / `search` calls.
4. **Dependencies:** `npm audit` read-only; plan **Next** upgrades for transitive advisories.
5. **Optional hardening:** CSP **report-only** dual header during policy changes; **search token** backend (**DD-3**).

---

## Disclaimer

This review is **guidance for engineers** based on repository inspection and `npm audit`. It does **not** replace a professional penetration test, a Coveo security review, or organizational SDLC requirements.
