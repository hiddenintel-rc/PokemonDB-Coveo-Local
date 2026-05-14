# Project documentation

Technical documentation for this **Coveo + Next.js** Pokémon search reference application. It is written for **solution architects**, **tech leads**, and **developers** onboarding to the codebase or Coveo footprint.

## Contents

| Document | Purpose |
|----------|---------|
| [architecture.md](./architecture.md) | End-to-end system architecture, deployment units, data flow (including ML model paths), and boundaries between Coveo Cloud and the web app. |
| [design-decisions.md](./design-decisions.md) | DD-1 through **DD-16**: rationale for stack choices, Headless vs Atomic, client-side ML wiring (ART), client-side BST tier ranges (vs IPE), **DD-11** (optional automation not published), detail-page Coveo bypass, CSS3-only scraping selectors, **HTTP security headers + CSP + `next/image`**, analytics-mode `'legacy'` pinning, and **detail-page catalog UI** (stacked cards, light sheet, stat bar fills). |
| [application-components.md](./application-components.md) | Next.js application structure, React modules, hooks, and how UI regions map 1:1 to Headless controllers (including `buildNumericFacet`, `buildGeneratedAnswer`, `buildInteractiveResult`). |
| [coveo-platform-and-headless.md](./coveo-platform-and-headless.md) | **Coveo-specific:** platform pieces in use (Web crawl + optional YAML **Push** source, fields, three ML models, query pipeline), the **twelve** Headless controllers bundled in `getSearchControllers()` (search box, result list, seven string facets, two numeric facets, RGA), APIs called, and what the toolset provides versus custom code. |
| [coveo-admin-playbook.md](./coveo-admin-playbook.md) | **Operational how-to:** step-by-step Admin Console procedures — adding a new facet (Field → Web Scraping → Mapping → Rebuild → app), the worked **BST example** with all 7 selectors, Featured Result pinning, and the ML model lifecycle (Create model → Associate → App opt-in → verify/warm-up manually or with your own automation). |
| [next-steps.md](./next-steps.md) | **Roadmap:** shipped capabilities, Coveo platform optimizations (Featured Results, Thesaurus, QS, RGA, ART, ranking expressions, Passage Retrieval, DNE), and status flags. |
| [security-review.md](./security-review.md) | **Security pass:** CSP (nonce proxy + tight `img-src` / `connect-src`), `next/image` allowlists, HTTP headers, `NEXT_PUBLIC_*` semantics, and follow-ups (search tokens, new image hosts). |
| [owasp-deployment-review.md](./owasp-deployment-review.md) | **OWASP Top 10:2021** mapping for the live deployment: access control, crypto/TLS, injection, misconfiguration, components (`npm audit`), SSRF, logging gaps, and a short release checklist. |

**Hosting:** The Next.js deliverable is built from **`web/`** and deployed by **Vercel** against the **GitHub** remote (push → build → live site). See the root [`README.md`](../README.md#deployment-github--vercel) section *Deployment (GitHub → Vercel)* and [`architecture.md`](./architecture.md) §5.

## Repository layout (quick reference)

| Path | Role |
|------|------|
| `docs/` | This documentation set. |
| `web/` | Next.js application (search UI, `@coveo/headless`) — the deliverable. |
| `tools/seed-ml/`, `tools/push-yaml/` | **Gitignored** optional directories (Playwright ML warm-up / Coveo Push CLI). Not published with the repo; recreate locally if you need them. |
| `.cursor/rules/` | Cursor IDE rules: `coveo-platform.mdc` (Coveo + app context, `alwaysApply: true`), `coveo-indexing.mdc` (crawler/scraping config + field schema), `coveo-headless-react.mdc` (Headless patterns + code samples from this repo). |
| `web/AGENTS.md` | Warning for AI agents: this is Next.js **16.2.x** with breaking changes vs older training data; check `node_modules/next/dist/docs/` before writing route handlers. |

Content indexing (Web source, fields, web scraping, ML models) is configured in the **Coveo Administration Console**, not in this repo.

### Detail page and catalog UI (May 2026)

The **`/pokemon/[slug]`** experience is documented in **`application-components.md`** ( **`PokedexDetailChrome`**, stacked **Stats** card, **`nationalDex`**) and **DD-16** in **`design-decisions.md`**. Search and detail share **`bg-pokedex-catalog`**, a centered **`bg-white/95`** content column pattern, and **sky** accents so Vercel builds match the local “Pokédex catalog” look.

**Versions** in use are defined in `web/package.json` (the narrative docs intentionally use `16.2.x` / `19.2.x` style ranges so patch bumps do not require editing every sentence).
