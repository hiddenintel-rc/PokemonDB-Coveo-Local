import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { YAML_EXPORT_FIELDS_TO_INCLUDE } from "./fields.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

for (const p of [join(REPO_ROOT,"web",".env.local"), join(REPO_ROOT,"web",".env")]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p,"utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("="); if (eq <= 0) continue;
    const k = t.slice(0,eq).trim(), v = t.slice(eq+1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const orgId  = process.env.NEXT_PUBLIC_COVEO_ORG_ID;
const apiKey = process.env.NEXT_PUBLIC_COVEO_API_KEY;
const SOURCE_ES = "PokemonDB Reference (YAML) \u2014 ES";

const url = `https://platform.cloud.coveo.com/rest/search/v2?organizationId=${encodeURIComponent(orgId)}`;

const countBody = {
  organizationId: orgId,
  cq: `@source=="${SOURCE_ES}"`,
  q: "",
  numberOfResults: 0,
  analytics: { enabled: false },
};

const resCount = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(countBody),
});
const countJson = await resCount.json();
console.log(`totalCount in ES source (@source filter only): ${countJson.totalCount}`);

const body = {
  organizationId: orgId,
  cq: `@source=="${SOURCE_ES}"`,
  q: "@uri==https://pokemondb.net/pokedex/bulbasaur",
  numberOfResults: 1,
  fieldsToInclude: YAML_EXPORT_FIELDS_TO_INCLUDE,
  analytics: { enabled: false },
};

const res  = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json = await res.json();

console.log(`Bulbasaur sample query totalCount: ${json.totalCount}`);
for (const hit of json.results ?? []) {
  const r = hit.raw ?? {};
  console.log("\n─── " + hit.title + " — all raw keys returned ───");
  console.log(JSON.stringify(r, null, 2));
}
if (!json.results?.length) {
  console.log("No results yet — indexing may still be in progress, or the cq source filter needs a moment.");
  console.log("Raw response status:", res.status);
}
