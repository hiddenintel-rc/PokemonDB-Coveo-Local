# `web/` — Pokémon Search (Next.js + `@coveo/headless`)

The deliverable Next.js application for the Coveo Pokémon Challenge. Architecture, design decisions, Coveo admin procedures, and the project roadmap live one directory up — see **[`../README.md`](../README.md)** for the entry point and **[`../docs/`](../docs/README.md)** for the full doc set.

## Quick start

```bash
cp .env.example .env.local      # add NEXT_PUBLIC_COVEO_ORG_ID + NEXT_PUBLIC_COVEO_API_KEY
npm install
npm run dev                     # http://localhost:3000
```

Without env vars, the page renders an inline "env missing" banner instead of crashing — `next build` and `npm run lint` both succeed without Coveo credentials.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Fast Refresh). |
| `npm run build` | Production build (`next build`). |
| `npm run start` | Serve the production build (`next start`). |
| `npm run lint` | ESLint (`eslint-config-next` v16). |

## Key files (see `docs/application-components.md` for the full map)

| Path | Role |
|---|---|
| `src/app/page.tsx` | Home route — renders `SearchInterface`. |
| `src/app/pokemon/[slug]/page.tsx` | Detail route — renders `<PokemonDetailView key={slug} slug={slug} />`. |
| `src/coveo/search-instance.ts` | Engine + all seven Headless controllers + `BST_TIERS` source of truth. |
| `src/coveo/fetch-pokemon-by-slug.ts` | Detail-page Coveo Search API fetch (analytics-disabled). |
| `src/components/search/SearchInterface.tsx` | All search UI — search box w/ QS, four facets, RGA panel, result cards w/ BST chip, env-guard banner. |
| `src/components/pokemon/PokemonDetailView.tsx` | Detail page — skeleton / found / not-found / error states. |
| `src/hooks/useCoveoController.ts` | Generic `controller.subscribe()` → React state bridge. |

## Optional companion package

`tools/seed-ml/` (sibling directory) contains a Playwright runner that warms up the three associated Coveo ML models (`pokemon_QS`, `pokemon_RGA`, `pokemon_ART`) by driving this live app. **Not** installed by `web/` — see `../docs/coveo-admin-playbook.md` §3 Phase 4 for usage.

---

**Next.js version note:** This project runs **Next.js 16.2.x** with breaking changes versus older Next.js conventions. The `params` prop on dynamic routes is now a `Promise` (unwrap with React's `use()` hook). When extending routes, read [`../web/AGENTS.md`](./AGENTS.md) first.
