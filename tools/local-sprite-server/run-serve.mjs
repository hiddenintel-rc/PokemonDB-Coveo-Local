/**
 * Serves the PokeAPI-style `sprites/` tree on loopback :8787.
 *
 * Default: `…/Coding Projects/pokemonDB-master/sprites-master/sprites`
 * (three levels up from this file: repo/tools/local-sprite-server → repo → parent → sibling).
 *
 * Override: SPRITES_DIR=/absolute/path/to/sprites
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultSpritesRoot = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "pokemonDB-master",
  "sprites-master",
  "sprites",
);

const root = (process.env.SPRITES_DIR ?? "").trim() || defaultSpritesRoot;

if (!fs.existsSync(root)) {
  console.error(
    `[local-sprite-server] Sprites directory not found:\n  ${root}\n\n` +
      `Set SPRITES_DIR to your sprites-master/sprites folder, or clone pokemonDB-master alongside this repo.`,
  );
  process.exit(1);
}

function resolveServeEntry() {
  const candidates = [
    path.join(__dirname, "node_modules", "serve", "build", "main.js"),
    path.join(__dirname, "node_modules", "serve", "cli.js"),
    path.join(__dirname, "node_modules", "serve", "lib", "main.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const serveJs = resolveServeEntry();
if (!serveJs) {
  console.error(`[local-sprite-server] Run: npm install (in tools/local-sprite-server/)`);
  process.exit(1);
}

console.log(`[local-sprite-server] Serving: ${root}`);
console.log(`[local-sprite-server] URL:     http://127.0.0.1:8787`);

const child = spawn(
  process.execPath,
  [serveJs, root, "-l", "tcp://127.0.0.1:8787", "-n"],
  { stdio: "inherit", cwd: __dirname },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
