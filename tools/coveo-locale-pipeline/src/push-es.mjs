/**
 * Push Spanish YAML documents to the Coveo "PokemonDB Reference (YAML) — ES" Push source.
 *
 * Reads:  output/yaml-source-es.jsonl
 * Writes: output/push-manifest-es.json  (run record: timestamp, count, errors)
 *
 * Requires env vars (web/.env.local or web/.env):
 *   NEXT_PUBLIC_COVEO_ORG_ID   — already used by the app
 *   COVEO_ES_PUSH_SOURCE_ID    — ES Push source ID (Admin → Sources → URL …/sources/{id}/…)
 *   COVEO_ES_PUSH_API_KEY      — Push-enabled API key for the ES source
 *                                 Admin → API Keys → Add → "Push" permission
 *
 * Usage (from repo root):
 *   node tools/coveo-locale-pipeline/src/push-es.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const REPO_ROOT = join(PACKAGE_ROOT, "..", "..");
const OUTPUT_DIR = join(PACKAGE_ROOT, "output");
const ES_JSONL = join(OUTPUT_DIR, "yaml-source-es.jsonl");
const MANIFEST_PATH = join(OUTPUT_DIR, "push-manifest-es.json");

let _pushConfig = null;
function pushConfig() {
  if (!_pushConfig) {
    loadWebEnv();
    const orgId = requireEnv("NEXT_PUBLIC_COVEO_ORG_ID");
    const sourceId = requireEnv("COVEO_ES_PUSH_SOURCE_ID");
    _pushConfig = {
      orgId,
      sourceId,
      base: `https://api.cloud.coveo.com/push/v1/organizations/${orgId}/sources/${sourceId}`,
    };
  }
  return _pushConfig;
}
const CONCURRENCY = 5;

/** Fields stored as arrays in the YAML source. Must match what Coveo Admin has as multi-value. */
const MULTI_VALUE_FIELDS = new Set([
  "pokemontype",
  "pokemonability",
  "pokemonevyield",
]);

/** System/internal Coveo fields that should NOT be re-pushed as metadata. */
const SKIP_FIELDS = new Set([
  "permanentid",
  "sysurihash",
  "urihash",
  "syspictureuri",
]);

// ── Env loading ──────────────────────────────────────────────────────────────
function loadWebEnv() {
  const paths = [
    join(REPO_ROOT, "web", ".env.local"),
    join(REPO_ROOT, "web", ".env"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v)
    throw new Error(
      `Missing env var: ${name}\nAdd it to web/.env.local (never commit the real value).`,
    );
  return v;
}

// ── Document builder ─────────────────────────────────────────────────────────
/**
 * Convert one ES JSONL row to the Coveo Push API document body.
 * `documentId` goes in the query string; the rest goes in the JSON body.
 */
function buildPushBody(doc) {
  const raw = doc.raw ?? {};
  const metadata = {};

  for (const [field, value] of Object.entries(raw)) {
    if (SKIP_FIELDS.has(field)) continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    metadata[field] = value;
  }

  // Coveo Push API expects metadata fields at ROOT level (not nested under a
  // "metadata" key). Spreading here maps each key directly to its indexed field.
  return {
    title: doc.title,
    clickableUri: doc.clickUri ?? doc.uri,
    ...metadata,
  };
}

// ── Push helpers ─────────────────────────────────────────────────────────────
async function pushDocument(doc, apiKey) {
  const documentId = encodeURIComponent(doc.uri);
  const url = `${pushConfig().base}/documents?documentId=${documentId}`;
  const body = buildPushBody(doc);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `${res.status} ${res.statusText} for ${doc.uri}${errText ? `: ${errText.slice(0, 300)}` : ""}`,
    );
  }
  return res.status; // 202 Accepted is the normal success code
}

/** Run at most `concurrency` async tasks simultaneously. */
async function pooledMap(items, fn, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const previewCount = (() => {
    const idx = process.argv.indexOf("--preview");
    return idx !== -1 ? parseInt(process.argv[idx + 1], 10) || 3 : 3;
  })();

  loadWebEnv();
  const apiKey = dryRun ? "DRY_RUN" : requireEnv("COVEO_ES_PUSH_API_KEY");

  const lines = (await readFile(ES_JSONL, "utf8"))
    .trim()
    .split(/\n/)
    .filter(Boolean);
  const docs = lines.map((l) => JSON.parse(l));

  if (dryRun) {
    pushConfig();
    const preview = docs.slice(0, previewCount);
    console.log(`\n══ DRY RUN — showing first ${preview.length} of ${docs.length} documents ══`);
    console.log(`Target: PUT ${pushConfig().base}/documents?documentId={encodedUri}`);
    console.log(`Authorization: Bearer COVEO_ES_PUSH_API_KEY (not required for dry run)\n`);

    for (const doc of preview) {
      const url = `${pushConfig().base}/documents?documentId=${encodeURIComponent(doc.uri)}`;
      const body = buildPushBody(doc);
      console.log("─".repeat(70));
      console.log(`URI:   ${doc.uri}`);
      console.log(`URL:   PUT ${url}`);
      console.log("Body:", JSON.stringify(body, null, 2));
    }

    console.log("\n" + "─".repeat(70));
    console.log(`Dry run complete. ${docs.length} documents ready to push.`);
    console.log(`Run without --dry-run (with COVEO_ES_PUSH_API_KEY set) to push live.`);
    return;
  }

  console.log(`Pushing ${docs.length} documents to Coveo ES Push source…`);

  const errors = [];
  let pushed = 0;

  await pooledMap(
    docs,
    async (doc, idx) => {
      try {
        await pushDocument(doc, apiKey);
        pushed++;
        if (pushed % 100 === 0 || pushed === docs.length) {
          process.stderr.write(`\rPushed ${pushed} / ${docs.length} …`);
        }
      } catch (e) {
        errors.push({ uri: doc.uri, error: e.message });
      }
    },
    CONCURRENCY,
  );

  process.stderr.write("\n");

  const manifest = {
    version: 1,
    pushedAt: new Date().toISOString(),
    sourceId: pushConfig().sourceId,
    sourceDisplayName: "PokemonDB Reference (YAML) — ES",
    totalDocuments: docs.length,
    successCount: pushed,
    errorCount: errors.length,
    errors,
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (errors.length > 0) {
    console.error(`\n⚠  ${errors.length} document(s) failed. See ${MANIFEST_PATH}`);
    errors.slice(0, 5).forEach((e) => console.error(`  ${e.uri}: ${e.error}`));
  } else {
    console.log(`✓ All ${pushed} documents pushed successfully.`);
  }
  console.log(`Manifest → ${MANIFEST_PATH}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
