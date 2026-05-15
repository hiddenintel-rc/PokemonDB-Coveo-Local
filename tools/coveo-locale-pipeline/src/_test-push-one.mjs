/**
 * One-shot test: push a single Bulbasaur doc (with `data` field) to force
 * a fresh re-index and confirm field mapping works.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

function loadWebEnv() {
  for (const p of [join(REPO_ROOT, "web", ".env.local"), join(REPO_ROOT, "web", ".env")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadWebEnv();
const apiKey = process.env.COVEO_ES_PUSH_API_KEY;
if (!apiKey) { console.error("Missing COVEO_ES_PUSH_API_KEY"); process.exit(1); }

const orgId = process.env.NEXT_PUBLIC_COVEO_ORG_ID;
const sourceId = process.env.COVEO_ES_PUSH_SOURCE_ID;
if (!orgId || !sourceId) {
  console.error("Missing NEXT_PUBLIC_COVEO_ORG_ID or COVEO_ES_PUSH_SOURCE_ID");
  process.exit(1);
}
const docUri    = "https://pokemondb.net/pokedex/bulbasaur";
const url       = `https://api.cloud.coveo.com/push/v1/organizations/${orgId}/sources/${sourceId}/documents?documentId=${encodeURIComponent(docUri)}`;

// Include `data` so wordcount > 0 AND content hash changes, forcing a real re-index.
const body = {
  title:             "Bulbasaur",
  clickableUri:      docUri,
  data:              "Bulbasaur es un Pokémon de tipo Planta y Veneno. Generación 1.",
  pokemontype:       ["Planta", "Veneno"],
  pokemongeneration: "Generación 1",
  pokemonability:    ["Espesura", "Clorofila"],
  pokemonbst:        318,
  pokemonhp:         45,
  pokemonattack:     49,
  pokemondefense:    49,
  pokemonspatk:      65,
  pokemonspdef:      65,
  pokemonspeed:      45,
  pokemonspecies:    "Semilla",
  pokemongrowthrate: "medio lento",
  pokemoncatchrate:  45,
  pictureuri:        "https://img.pokemondb.net/artwork/large/bulbasaur.jpg",
};

console.log("Pushing test doc to ES source…");
console.log("URL:", url);
console.log("Body:", JSON.stringify(body, null, 2));

const res = await fetch(url, {
  method: "PUT",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const text = await res.text().catch(() => "");
console.log("\nResponse:", res.status, res.statusText);
if (text) console.log("Body:", text);

if (res.ok) {
  console.log("\nPush accepted. Wait ~30s then run _verify-es.mjs to check fields.");
} else {
  console.error("Push failed.");
  process.exit(1);
}
