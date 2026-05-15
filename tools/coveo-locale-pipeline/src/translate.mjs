/**
 * Translate English YAML source snapshot → Spanish JSONL.
 *
 * Reads:  output/yaml-source-en.jsonl
 * Reads:  glossaries/*.json  (English → Spanish maps, versioned in repo)
 * Writes: output/yaml-source-es.jsonl
 *         output/translate-report.json  (coverage stats + any missing terms)
 *
 * Usage (from repo root):
 *   node tools/coveo-locale-pipeline/src/translate.mjs
 */

import { createWriteStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(PACKAGE_ROOT, "output");
const GLOSSARY_DIR = join(PACKAGE_ROOT, "glossaries");

const EN_JSONL = join(OUTPUT_DIR, "yaml-source-en.jsonl");
const ES_JSONL = join(OUTPUT_DIR, "yaml-source-es.jsonl");
const REPORT_PATH = join(OUTPUT_DIR, "translate-report.json");

async function loadGlossary(name) {
  const p = join(GLOSSARY_DIR, `${name}-en-es.json`);
  const text = await readFile(p, "utf8");
  return JSON.parse(text);
}

/** Translate a single string value via a glossary. Returns null if not found. */
function lookup(glossary, value) {
  if (value === undefined || value === null) return null;
  return glossary[String(value)] ?? null;
}

/** Translate an array of strings via a glossary; records any misses. */
function translateArray(glossary, arr, misses, fieldName) {
  if (!Array.isArray(arr)) return arr;
  return arr.map((v) => {
    const es = lookup(glossary, v);
    if (es === null) {
      misses[fieldName] = misses[fieldName] ?? new Set();
      misses[fieldName].add(String(v));
      return v; // fall back to English
    }
    return es;
  });
}

/** Translate a single string via a glossary; records any misses. */
function translateString(glossary, val, misses, fieldName) {
  if (val === undefined || val === null) return val;
  const es = lookup(glossary, val);
  if (es === null) {
    misses[fieldName] = misses[fieldName] ?? new Set();
    misses[fieldName].add(String(val));
    return val; // fall back to English
  }
  return es;
}

/** Best-effort Spanish title translation.
 *  Most Pokémon names are the same in EN and ES; only a handful have official
 *  Spanish versions (Nidoran♂/♀ stays as-is, accented names are kept as-is).
 *  The title is kept as-is so URIs/slugs stay consistent.
 */
function translateTitle(title) {
  return title; // Pokémon proper names are identical in Spanish
}

async function main() {
  // Load all glossaries
  const [types, abilities, generations, growthrates, evyield, species, forms] =
    await Promise.all([
      loadGlossary("types"),
      loadGlossary("abilities"),
      loadGlossary("generations"),
      loadGlossary("growthrates"),
      loadGlossary("evyield"),
      loadGlossary("species"),
      loadGlossary("forms"),
    ]);

  const lines = (await readFile(EN_JSONL, "utf8"))
    .trim()
    .split(/\n/)
    .filter(Boolean);

  const out = createWriteStream(ES_JSONL, { flags: "w", encoding: "utf8" });

  // Track misses per field for the report
  const misses = {};
  let written = 0;

  for (const line of lines) {
    const doc = JSON.parse(line);
    const raw = doc.raw ?? {};

    const esRaw = {
      ...raw,
      // --- arrays: element-wise glossary lookup ---
      pokemontype: translateArray(types, raw.pokemontype, misses, "pokemontype"),
      pokemonability: translateArray(abilities, raw.pokemonability, misses, "pokemonability"),
      pokemonevyield: translateArray(evyield, raw.pokemonevyield, misses, "pokemonevyield"),

      // --- single strings ---
      pokemongeneration: translateString(generations, raw.pokemongeneration, misses, "pokemongeneration"),
      pokemongrowthrate: translateString(growthrates, raw.pokemongrowthrate, misses, "pokemongrowthrate"),
      pokemonspecies: translateString(species, raw.pokemonspecies, misses, "pokemonspecies"),
      pokemonform: raw.pokemonform
        ? translateString(forms, raw.pokemonform, misses, "pokemonform")
        : raw.pokemonform,

      // --- pass-through (numeric / URL / release code) ---
      // pokemonrelease, pictureuri, syspictureuri, pokemonbst,
      // pokemonhp, pokemonattack, pokemondefense, pokemonspatk,
      // pokemonspdef, pokemonspeed, pokemonnationalnumber,
      // pokemonheight, pokemonweight, pokemoncatchrate
    };

    const esDoc = {
      uri: doc.uri,
      clickUri: doc.clickUri,
      title: translateTitle(doc.title),
      raw: esRaw,
    };

    out.write(`${JSON.stringify(esDoc)}\n`);
    written++;
  }

  out.end();
  await new Promise((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });

  // Build report
  const missReport = {};
  let totalMissed = 0;
  for (const [field, set] of Object.entries(misses)) {
    missReport[field] = [...set].sort();
    totalMissed += set.size;
  }

  const report = {
    version: 1,
    translatedAt: new Date().toISOString(),
    totalDocuments: written,
    totalMissingTerms: totalMissed,
    missingByField: missReport,
  };

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Translated ${written} rows → ${ES_JSONL}`);
  if (totalMissed > 0) {
    console.warn(`⚠ ${totalMissed} term(s) had no glossary match — kept as English. See ${REPORT_PATH}`);
  } else {
    console.log("✓ All terms resolved via glossaries — no fallbacks.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
