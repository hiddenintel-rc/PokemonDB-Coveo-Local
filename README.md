# Pokemon Search Challenge — Coveo + React

A Coveo-powered search page built with `@coveo/headless`, **Next.js** (App Router), and TypeScript. The deliverable UI lives in **`web/`** as its own npm package (`"name": "web"`), separate from the repo root.

**Architecture and Coveo integration docs:** see the [`docs/`](./docs/README.md) folder (solution-architect oriented).

**Current stack (from `web/package.json`):** Next.js **16.2.x**, React **19.2.x**, Tailwind CSS **4.x**, `@coveo/headless` **^3.50.1**.

---

## Official challenge checklist (Pre-Sales 2026 brief)

This section tracks the **Pokémon Challenge (Pre-Sales, 2026)** document line-by-line: **Goals**, **Essential**, **Intermediate**, **Advanced**, **Bonus**.

**Legend**

| Tag | Meaning |
|-----|---------|
| **[App]** | Implemented in this repository (`web/` Next.js + Headless). Update these boxes when the code changes. |
| **[Org]** | Your Coveo Cloud org (Admin Console: sources, fields, crawl/scrape, API keys). Not stored in git—tick when **your** environment satisfies the item. |
| **[Ship]** | Submission deliverables (GitHub, hosting, slides, interviews). |

### Goals

> *“The main goal will be to index pokemondb.net and customize your search page to include certain features.”*

- [ ] **[Org]** Index **pokemondb.net** with your Coveo org (Web crawler **or** Push source).
- [x] **[App]** Customize the **local search page** (facets, images, Headless wiring — see `web/src/`).

### Essential

> *“ESSENTIAL” section of the challenge brief.*

- [ ] **[Org]** Open your email and **accept the invitation** to your Coveo Cloud Organization.
- [x] **[App]** **Install Headless locally** — `@coveo/headless` in `web/` (this repo uses **Headless**, not Atomic).
- [ ] **[Org]** **Index (crawl) pokemondb.net** using your Cloud Platform Organization.
  - [ ] **[Org]** **Include only the actual Pokémon pages** in the crawler **and exclude everything else** (Moves, Types, Abilities, Items, etc.). See [`.cursor/rules/coveo-indexing.mdc`](./.cursor/rules/coveo-indexing.mdc).
  - [ ] **[Org]** *(Tip from brief)* Optional **single-Pokémon source** for fast scrape/crawl iteration.
- [ ] **[Org]** **Web scraping configuration** (and field mappings) so Type, Generation, and image URL are stored — e.g. `pokemontype`, `pokemongeneration`, `pictureuri`. See [Web Scraping Configuration](https://docs.coveo.com/en/1580/) and [`coveo-indexing.mdc`](./.cursor/rules/coveo-indexing.mdc).
- [ ] **[Org]** **Custom fields** in Admin (facet-capable where needed) aligned with the UI.
- [x] **[App]** **Connect your local search page to the cloud endpoint** — `NEXT_PUBLIC_COVEO_*` env vars + Headless engine (`web/src/coveo/search-instance.ts`).
- [x] **[App]** **Create a facet** to filter search results by **Pokémon Type** (`pokemontype`).
- [x] **[App]** **Create a facet** to filter search results by **Pokémon Generation** (`pokemongeneration`).
- [x] **[App]** **Display the Pokémon’s picture directly in their search result** — result card + indexed artwork URL; **`fieldsToInclude`** on ResultList so `pictureuri` / `syspictureuri` appear in `result.raw`.

**Application details (what `[App]` covers today)**

- Next.js (App Router) + TypeScript under `web/`.
- Search box, result list, initial `executeFirstSearch()`, client-only engine with **`coveoConfigured()`** guard so `next build` works without Coveo secrets.

### Intermediate

> *“INTERMEDIATE” section of the challenge brief.*

- [ ] **[Ship]** **Host your code on GitHub** and share the link.
- [ ] **[Ship]** **Host your search app** so reviewers can open it (e.g. Vercel, Netlify — set the same `NEXT_PUBLIC_*` variables in the host dashboard).

### Advanced

> *“ADVANCED” section of the challenge brief.*

- [ ] **[Org] / [Ship]** **Deploy Coveo RGA** for a generative experience.
- [ ] **[Org]** **Preload a Query Suggest model** for type-ahead.
- [ ] **[App]** **Add a Pokémon Detail Page** for a single Pokémon (not implemented yet — see [`docs/application-components.md`](./docs/application-components.md)).
- [ ] **[Ship]** **Prepare a presentation** covering **both** topics from the brief:
  - Technical deep dive (what you built, Coveo configuration; format is your choice: demo, slides, docs, mix).
  - **Enterprise angle:** a past/present customer who could benefit from a similar Coveo solution + value proposition.

### Bonus

> *“BONUS” — Passage Retrieval API.*

- [ ] **[App] / [Ship]** Build something on the **Coveo Passage Retrieval API**, **or** document understanding + a **point of view** on future use cases (minimum stated in brief).

### Brief documentation pointers (not scored)

> *Documentation & tips from the challenge PDF.*

- [ ] **[Org]** Use Coveo’s **built-in search page editor** for quick experiments; **transfer behavior into this local app** for the submission.
- General docs: [docs.coveo.com](https://docs.coveo.com).

---

## Local Development Setup

### Prerequisites
- Node.js 20.9.0+
- A Coveo Cloud Organization (invitation accepted)

### Environment Variables

1. In **`web/`**, copy **`.env.example`** and create **`.env`** or **`.env.local`** with real values (both are gitignored; never commit credentials). The in-app “env missing” banner mentions `.env.local`, which matches common Next.js usage.
2. Fill in `NEXT_PUBLIC_COVEO_ORG_ID` and `NEXT_PUBLIC_COVEO_API_KEY` at minimum.

```bash
NEXT_PUBLIC_COVEO_ORG_ID=your_organization_id
NEXT_PUBLIC_COVEO_API_KEY=your_api_key
# Optional; defaults to PokemonSearch — must match Search hub enforced on the API key, if any
NEXT_PUBLIC_COVEO_SEARCH_HUB=PokemonSearch
```

For **production**, set the same variable names in your host’s dashboard (e.g. Vercel **Environment Variables**), not in git.

> Keys: Coveo Admin Console → API Keys → Anonymous search template (public content only).

### Install & Run

```bash
cd web
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Key References

| Resource | URL |
|---|---|
| Coveo Admin Console | https://platform.cloud.coveo.com/admin/ |
| Coveo Docs | https://docs.coveo.com |
| Headless Docs | https://docs.coveo.com/en/headless/latest/reference/documents/index.html |
| Headless Getting Started | https://docs.coveo.com/en/headless/latest/reference/documents/getting-started/getting-started-search.html |
| Headless React Sample | https://github.com/coveo/ui-kit/tree/main/samples/headless/search-react |
| Coveo CLI | https://github.com/coveo/cli#readme |
| Web Scraping Config Guide | https://docs.coveo.com/en/1580/ |
| Fields in Coveo | https://docs.coveo.com/en/1833/ |

---

## Architecture Notes

- Search UI is client-only (`SearchInterface`); **`coveoConfigured()`** gates rendering so the engine is only used when org ID and API key are non-empty—`next build` succeeds without secrets.
- Engine and controllers are singletons (`web/src/coveo/search-instance.ts`).
- Components subscribe with `useCoveoController` and mirror Headless state.
- Facets use fields `pokemontype` (up to **25** values) and `pokemongeneration` (**15** values). Images and metadata are read from `result.raw`; the ResultList controller sets **`fieldsToInclude`** so those custom fields are present in each hit (see `web/src/coveo/search-instance.ts`). Fallback field names are documented below.

---

## pokemondb.net Field Mapping

| Data | HTML Location | Coveo field (UI reads) |
|---|---|---|
| Pokemon name | `<h1>` title | `title` (default) |
| Page URL | Page URI | `uri` / `clickUri` (default) |
| Type(s) | Vitals table → "Type" row → `.type-icon` links | `pokemontype` |
| Generation | Vitals table → "Generation" row | `pokemongeneration` (or `pokemon_generation` in `result.raw` if indexed under that name) |
| Image/sprite | Typically `og:image` meta or main artwork link (see [`.cursor/rules/coveo-indexing.mdc`](./.cursor/rules/coveo-indexing.mdc)) | `pictureuri` (fallbacks: `picture_uri`, `syspictureuri` in `result.raw`) |
