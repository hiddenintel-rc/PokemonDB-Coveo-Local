# Local sprite static server

Serves **`pokemonDB-master/sprites-master/sprites`** (PokeAPI layout) at **`http://127.0.0.1:8787`**.

This folder **is safe to commit** — it contains no sprite binaries, only Node + `serve`.

## Setup

```bash
cd tools/local-sprite-server
npm install
npm run serve
```

In **`web/.env.local`** (gitignored):

```bash
NEXT_PUBLIC_SPRITE_ASSET_BASE_URL=http://127.0.0.1:8787
```

Then run **`web`** with `npm run dev`.

## Paths

Default sprite root assumes:

```text
Coding Projects/
  pokemonDB-SearchCoveo/   ← this repo
  pokemonDB-master/
    sprites-master/sprites/
```

Override with **`SPRITES_DIR`** (absolute path to the `sprites` directory).

See **`docs/sprite-assets-local-handoff.md`** for CSP / `next/image` notes.
