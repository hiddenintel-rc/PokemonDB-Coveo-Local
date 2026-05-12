# Project documentation

Technical documentation for the Pokémon / Coveo challenge solution. It is written for **solution architects**, **tech leads**, and **developers** onboarding to the codebase or Coveo footprint.

## Contents

| Document | Purpose |
|----------|---------|
| [architecture.md](./architecture.md) | End-to-end system architecture, deployment units, data flow (including ML model paths), and boundaries between Coveo Cloud and the web app. |
| [design-decisions.md](./design-decisions.md) | DD-1 through DD-13: rationale for stack choices, Headless vs Atomic, client-side ML wiring (ART), client-side BST tier ranges (vs IPE), separate seeder package, detail-page Coveo bypass, and CSS3-only scraping selectors. |
| [application-components.md](./application-components.md) | Next.js application structure, React modules, hooks, and how UI regions map 1:1 to Headless controllers (including `buildNumericFacet`, `buildGeneratedAnswer`, `buildInteractiveResult`). |
| [coveo-platform-and-headless.md](./coveo-platform-and-headless.md) | **Coveo-specific:** platform pieces in use (source, fields, three ML models, query pipeline), the seven Headless controllers, APIs called, and what the toolset provides versus custom code. |
| [coveo-admin-playbook.md](./coveo-admin-playbook.md) | **Operational how-to:** step-by-step Admin Console procedures — adding a new facet (Field → Web Scraping → Mapping → Rebuild → app), the worked **BST example** with all 7 selectors, Featured Result pinning, and the ML model lifecycle (Create model → Associate → App opt-in → Verify/warm-up via `tools/seed-ml/`). |
| [next-steps.md](./next-steps.md) | **Roadmap:** Ability + BST facets and detail route (all Shipped); 10 Coveo platform optimization opportunities (Featured Results / Thesaurus / QS / RGA / ART / ranking expressions / Passage Retrieval / DNE) with status flags. |

## Repository layout (quick reference)

| Path | Role |
|------|------|
| `docs/` | This documentation set. |
| `web/` | Next.js application (search UI, `@coveo/headless`) — the deliverable. |
| `tools/seed-ml/` | **Optional** Playwright package for Coveo ML warm-up — separate `npm install`; not required to build or run `web/`. |
| `.cursor/rules/` | Cursor IDE rules: `coveo-platform.mdc` (challenge context, `alwaysApply: true`), `coveo-indexing.mdc` (crawler/scraping config + 11-field schema), `coveo-headless-react.mdc` (Headless patterns + actual code samples from this repo). |
| `web/AGENTS.md` | Warning for AI agents: this is Next.js **16.2.x** with breaking changes vs older training data; check `node_modules/next/dist/docs/` before writing route handlers. |

Content indexing (Web source, fields, web scraping, ML models) is configured in the **Coveo Administration Console**, not in this repo.

**Versions** in use are defined in `web/package.json` (the narrative docs intentionally use `16.2.x` / `19.2.x` style ranges so patch bumps do not require editing every sentence).
