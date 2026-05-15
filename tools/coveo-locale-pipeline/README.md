# Coveo locale pipeline (YAML → local → ES)

Automation that talks to the **Coveo Search API** (export) and **Push API** (Spanish ingest) for the YAML Pokémon dataset.

## Prerequisites

Add to **`web/.env`** or **`web/.env.local`** (never commit real secrets):

| Variable | Used by |
|----------|---------|
| `NEXT_PUBLIC_COVEO_ORG_ID` | App + export + push + verify scripts |
| `NEXT_PUBLIC_COVEO_API_KEY` | App + export + verify (Search) |
| `NEXT_PUBLIC_COVEO_SEARCH_HUB` | Optional; defaults to `PokemonSearch` |
| `COVEO_ES_PUSH_SOURCE_ID` | Push scripts — source ID from Admin URL `…/sources/{id}/documents` |
| `COVEO_ES_PUSH_API_KEY` | Push scripts — API key with Push permission on the ES source |

Optional override for export: `COVEO_YAML_SOURCE_NAME` if the English YAML Push source display name in Admin differs from `PokemonDB Reference (YAML)`.

## Glossaries (committed)

English → Spanish maps live in **`glossaries/*.json`** (not under `output/`). Update these when the English index gains new facet values.

## Export

From **repository root**:

```bash
node tools/coveo-locale-pipeline/src/export-yaml-source.mjs
```

Or:

```bash
cd tools/coveo-locale-pipeline && npm run export:yaml-en
```

## Translate

Requires `output/yaml-source-en.jsonl` from export:

```bash
node tools/coveo-locale-pipeline/src/translate.mjs
```

Writes `output/yaml-source-es.jsonl` and `output/translate-report.json`.

## Push (Spanish source)

```bash
node tools/coveo-locale-pipeline/src/push-es.mjs
```

Dry run (no API key required for the PUT itself; org + source ID still required for URL preview):

```bash
node tools/coveo-locale-pipeline/src/push-es.mjs --dry-run --preview 1
```

## Generated outputs (gitignored)

The `output/` folder holds large or machine-generated files (JSONL, manifests, reports). Only **`glossaries/`** at the package root is versioned.

## Frontend alignment

- Source scope matches `web/src/coveo/search-instance.ts` and `yaml-data-locale.ts`.
- `src/fields.mjs` should stay aligned with `fieldsToInclude` in `search-instance.ts` and `DETAIL_FIELDS_TO_INCLUDE` in `fetch-pokemon-by-slug.ts`.
