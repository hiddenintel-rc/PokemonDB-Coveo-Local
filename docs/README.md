# Project documentation

Technical documentation for the Pokémon / Coveo challenge solution. It is written for **solution architects**, **tech leads**, and **developers** onboarding to the codebase or Coveo footprint.

## Contents

| Document | Purpose |
|----------|---------|
| [architecture.md](./architecture.md) | End-to-end system architecture, deployment units, data flows, and boundaries between Coveo Cloud and the web app. |
| [design-decisions.md](./design-decisions.md) | Rationale for stack choices, Headless vs Atomic, SSR/build behavior, folder layout, and indexing strategy (high level). |
| [application-components.md](./application-components.md) | Next.js application structure, React modules, hooks, and how UI maps to Headless controllers. |
| [coveo-platform-and-headless.md](./coveo-platform-and-headless.md) | **Coveo-specific:** platform pieces in use, Headless controllers included, APIs involved, and what the toolset provides versus custom code. |
| [coveo-admin-playbook.md](./coveo-admin-playbook.md) | **Operational how-to:** step-by-step Admin Console procedures (currently: end-to-end recipe for adding a new facet — Field → Web Scraping → Mapping → Rebuild → app wiring). |
| [next-steps.md](./next-steps.md) | **Planned work:** Ability + BST facets (pokemondb sourcing, Coveo fields, app touchpoints); deferred Legendary/Mythical facet rationale. |

## Repository layout (quick reference)

| Path | Role |
|------|------|
| `docs/` | This documentation set. |
| `web/` | Next.js application (search UI, `@coveo/headless`). |
| `.cursor/rules/` | Cursor IDE rules—for example `coveo-platform.mdc` (challenge context), `coveo-indexing.mdc` (crawler/scraping), `coveo-headless-react.mdc` (Headless patterns). |

Content indexing (Web source, fields, web scraping) is configured in **Coveo Administration Console**, not in this repo.

**Versions** in use are defined in `web/package.json` (the narrative docs intentionally use `16.2.x` / `19.2.x` style ranges so patch bumps do not require editing every sentence).
